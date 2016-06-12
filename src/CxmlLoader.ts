///<reference path="../typings/index.d.ts" />

namespace Pivot {

    let pivotNS = "http://schemas.microsoft.com/livelabs/pivot/collection/2009";

    /**
     * A class that can load CXML data into an existing PivotViewer.
     */
    export class CxmlLoader {

        /**
         * Load the CXML file from the given URL and place the content that it describes into the given PivotViewer.
         * @param {Pivot.PivotViewer} viewer The viewer
         * @param {string} url The URL of the CXML file to load
         */
        static load(viewer: PivotViewer, url: string) {
            if (!viewer || !url) {
                return;
            }

            $.ajax({
                type: "GET",
                url: url,
                dataType: "xml",
                success: (xml: XMLDocument) => {
                    if (!this.loadXml(viewer, xml, url)) {
                        Logger.logError("Failed to parse CXML: " + url);
                    }
                },
                error: () => {
                    // failure callback for fetching XML
                    Logger.logError("Failed to fetch CXML: " + url);
                }
            });
        }

        static loadXml(viewer: PivotViewer, xml: XMLDocument, url: string): boolean {
            if (!xml) {
                return false;
            }

            let imgBase = {};

            //// IE9 doesn't support getAttributeNS, so hack around it
            //function getAttributeNS(elmt, ns, name) {
            //    if (elmt.getAttributeNS) {
            //        return elmt.getAttributeNS(ns, name);
            //    }

            //    var atts = elmt.attributes, att, i, n = atts.length;
            //    for (i = 0; i < n; i++) {
            //        att = atts[i];
            //        if (att.namespaceURI === ns && att.baseName === name) {
            //            return att.value;
            //        }
            //    }
            //    return null;
            //}

            let xCollection = xml.documentElement;

            let facets = <FacetMap>{};

            // A constant value for XML nodes that are elements, not text or comments.
            let elementType = xCollection.ELEMENT_NODE || 1;
            let xSupplement = xCollection.getAttributeNS(pivotNS, "Supplement");
            if (xSupplement) {
                // fire off a new request for the supplemental CXML file.
                CxmlLoader.load(viewer, url.split("/").slice(0, -1).join("/") + "/" + xSupplement);
            }

            // Facet categories get set first
            let xName = xCollection.getAttribute("Name");
            if (xName) {
                viewer.setTitle(xName);
            }

            let xCategories = xCollection.getElementsByTagName("FacetCategories")[0];
            if (xCategories) {
                for (let i = 0; i < xCategories.childNodes.length; i++) {
                    let xFacet = xCategories.childNodes[i] as Element;
                    if (xFacet.nodeType === elementType) {
                        let facet = new Facet(xFacet.getAttribute("Name"));
                        facet.index = i;
                        facet.type = xFacet.getAttribute("Type") as FacetType;
                        let xIsFilterVisible = xFacet.getAttributeNS(pivotNS, "IsFilterVisible");
                        let xIsMetaDataVisible = xFacet.getAttributeNS(pivotNS, "IsMetaDataVisible");
                        let xIsWordWheelVisible = xFacet.getAttributeNS(pivotNS, "IsWordWheelVisible");
                        facet.isFilterVisible = xIsFilterVisible == null || xIsFilterVisible.trim() == "" || xIsFilterVisible === "true";
                        facet.isMetaDataVisible = xIsMetaDataVisible == null || xIsMetaDataVisible.trim() == "" || xIsMetaDataVisible === "true";
                        facet.isWordWheelVisible =
                            (xIsWordWheelVisible == null || xIsWordWheelVisible.trim() == "" || xIsWordWheelVisible === "true") &&
                            (facet.type === FacetTypes.String || facet.type === FacetTypes.LongString || facet.type === FacetTypes.Link);
                        facets[facet.name] = facet;

                        // the children of each FacetCategory could be extensions
                        let xExtensions = xFacet.childNodes;
                        for (let j = 0; j < xExtensions.length; j++) {
                            let xExtension = xExtensions[j].firstChild as Element;
                            if (xExtension) {
                                // test for the SortOrder extension
                                if (xExtension.localName === "SortOrder" && xExtension.namespaceURI === pivotNS) {
                                    let sortOrderObj = <SortOrder>{
                                        name: xExtension.getAttribute("Name"),
                                        order: <string[]>[]
                                    };
                                    facet.orders.push(sortOrderObj);

                                    // and now the sort values
                                    let xExtChildren = xExtension.childNodes;
                                    for (let k = 0; k < xExtChildren.length; k++) {
                                        let xExtChild = xExtChildren[k] as Element;
                                        if (xExtChild.localName === "SortValue" && xExtChild.namespaceURI === pivotNS) {
                                            sortOrderObj.order.push(xExtChild.getAttribute("Value"));
                                        }
                                    }
                                }
                                // TODO: process other extensions
                            }
                        }
                    }
                }
                viewer.setFacets(facets);
            }

            // look for the legal-info extension
            let xChildren = xCollection.childNodes;
            for (let i = xChildren.length - 1; i >= 0; i--) {
                let xChild = xChildren[i] as Element;
                if (xChild.tagName === "Extension") {
                    let xExtension = xChild.firstChild as Element;
                    if (xExtension && xExtension.localName === "Copyright" && xExtension.namespaceURI === pivotNS) {
                        viewer.setCopyright(<LegalInfo>{
                            href: url.split("/").slice(0, -1).join("/") + "/" + xExtension.getAttribute("Href"),
                            name: xExtension.getAttribute("Name")
                        });
                    }
                }
            }

            // now we can look through all of the items
            let xItems = xCollection.getElementsByTagName("Items")[0];
            if (!xItems) {
                // no item info in this file
                return false;
            }

            let xImgBase = xItems.getAttribute("ImgBase");
            if (xImgBase) {
                imgBase = url.slice(0, url.lastIndexOf("/") + 1) + xImgBase.replace("\\", "/");
            }

            let items = <Item[]>[];

            let secondLevel = xItems.childNodes;
            for (let i = 0; i < secondLevel.length; i++) {
                let cur = secondLevel[i] as Element;
                if (cur.nodeType === elementType) {
                    // try to get the existing item, if we already started building it in a previous chunk of CXML.
                    let id = cur.getAttribute("Id");
                    let item = viewer.getItemById(id) || new Item(id);
                    items.push(item);

                    let xHref = cur.getAttribute("Href");
                    if (xHref) {
                        item.href = xHref;
                    }
                    let xName = cur.getAttribute("Name");
                    if (xName) {
                        item.name = xName;
                    }
                    let xImg = cur.getAttribute("Img");
                    if (xImg) {
                        item.img = imgBase + xImg;
                    }
                    let xDescriptions = cur.getElementsByTagName("Description");
                    if (xDescriptions.length) {
                        item.description = xDescriptions[0].textContent;
                    }

                    let xFacets = cur.getElementsByTagName("Facets")[0];
                    if (xFacets) {
                        let xFacetsChildren = xFacets.childNodes;
                        for (let j = 0; j < xFacetsChildren.length; j++) {
                            let xFacet = xFacetsChildren[j] as Element;
                            if (xFacet.nodeType === elementType) {
                                let name = xFacet.getAttribute("Name");
                                let facet = facets[name];
                                let itemFacetList = item.facets[name] = <IFacetValue<any>[]>[];

                                let xFacetValues = xFacet.childNodes;
                                for (let k = 0; k < xFacetValues.length; k++) {
                                    let xFacetValue = xFacetValues[k] as Element;
                                    if (xFacetValue.nodeType === elementType) {
                                        let value: IFacetValue<any>;
                                        switch (facet.type) {
                                            case FacetTypes.String:
                                            case FacetTypes.LongString:
                                                value = <StringFacetValue>{
                                                    value: xFacetValue.getAttribute("Value").trim(),
                                                };
                                                break;
                                            case FacetTypes.Link:
                                                value = <LinkFacetValue>{
                                                    href: xFacetValue.getAttribute("Href"),
                                                    value: xFacetValue.getAttribute("Name").trim(),
                                                };
                                                break;
                                            case FacetTypes.Number:
                                                value = <NumberFacetValue>{
                                                    value: parseFloat(xFacetValue.getAttribute("Value").trim())
                                                };
                                                break;
                                            case FacetTypes.DateTime:
                                                value = <DateFacetValue>{
                                                    value: new Date(xFacetValue.getAttribute("Value").trim())
                                                };
                                                break;
                                            default:
                                                value = <UnknownFacetValue>{
                                                    value: xFacetValue.getAttribute("Value").trim()
                                                };
                                                Logger.logWarning("Unknown facet type " + facet.type);
                                                break;
                                        }
                                        itemFacetList.push(value);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // update the viewer's items. note that if this is the second half of the cxml,
            // we don't actually add any items, we're just updating properties on existing items.
            if (items.length) {
                viewer.addItems(items);
            }

            return true;
        }
    }
}
