///<reference path="../typings/index.d.ts" />
///<reference path="DatePicker.ts" />

namespace Pivot {

    /**
     * Set up and return a PivotViewer instance, created inside the given container element.
     * This method is responsible for setting up the title bar, search options, filters pane,
     * and details pane for the control. Unless you're interested in setting those things up
     * yourself, you should call this method rather than the Pivot.PivotViewer constructor.
     * @method init
     * @param div {HTMLElement} The container element
     * @param useHash {bool} Whether to adjust the URL fragment to represent current filter state
     * @return {Pivot.PivotViewer}
     */
    export class PivotViewerFactory {
        static init(element: HTMLElement | JQuery, useHash: boolean): PivotViewer {
            let div = $(element);

            // clear out the workspace we've been provided
            div.empty();

            // check whether the browser supports canvas
            if (!Helpers.isCanvasSupported()) {
                Logger.logError("Your browser doesn't support canvas! Get a better one.");
                // we should probably show a message on the screen
                return null;
            }

            // create the elements
            let inputElmt = $("<input>").attr("type", "checkbox").addClass("pivot_input").appendTo(div);
            let mainView = $("<div>").addClass("pivot pivot_viewbox").appendTo(div);
            let topBar = $("<div>").addClass("pivot pivot_topbar").appendTo(mainView);
            let title = $("<div>").addClass("pivot pivot_title").appendTo(topBar);
            let canvasBox = $("<div>").addClass("pivot pivot_canvas").appendTo(mainView);
            let mouseBox = $("<div>").addClass("pivot pivot_layer").appendTo(canvasBox);
            let behindLayer = $("<div>").addClass("pivot pivot_layer").appendTo(mouseBox);
            let canvas = $("<canvas>").addClass("pivot").appendTo(mouseBox);
            let frontLayer = $("<div>").addClass("pivot pivot_layer").appendTo(mouseBox);
            let filterPane = $("<div>").addClass("pivot pivot_pane pivot_filterpane").appendTo(canvasBox);

            let railWidth = filterPane.position().left + filterPane.outerWidth();

            // The actual viewer object that will do zooming, panning, layout, and animation.
            let viewer = new PivotViewer(canvas, mouseBox, frontLayer, behindLayer, railWidth, railWidth, inputElmt);

            let detailsPane = $("<div>").addClass("pivot pivot_pane pivot_detailspane pivot_hidden").hide().css("opacity", 0).appendTo(canvasBox);
            $("<div>").addClass("pivot_hoverable pivot_left pivot_larr").appendTo(detailsPane).click(() => {
                viewer.moveLeft();
            });
            $("<div>").addClass("pivot_left pivot_subtle pivot_vertbar").text("|").appendTo(detailsPane);
            $("<div>").addClass("pivot_hoverable pivot_left pivot_rarr").appendTo(detailsPane).click(() => {
                viewer.moveRight();
            });
            $("<div>").addClass("pivot_hoverable pivot_right pivot_collapse").appendTo(detailsPane).click(() => {
                viewer.collapseDetails();
            });
            let detailsPaneTitle = $("<a>").attr("target", "_blank").addClass("pivot").appendTo($("<h2>").addClass("pivot").appendTo(detailsPane));
            let detailsPaneContent = $("<div>").addClass("pivot pivot_scrollable").appendTo(detailsPane);
            let detailsPaneDescription = $("<div>").addClass("pivot pivot_description").appendTo(detailsPaneContent);
            let detailsPaneMore = $("<div>").addClass("pivot_sortlabel").appendTo(detailsPaneContent);
            let detailsPaneFacets = $("<dl>").addClass("pivot").appendTo(detailsPaneContent);
            let legalStuff = $("<div>").addClass("pivot_copyright").appendTo(detailsPane);
            let infoButton = $("<div>").addClass("pivot_info pivot_hidden").hide().css("opacity", 0).appendTo(canvasBox).click(() => {
                viewer.expandDetails();
            });

            // helper functions for expanding the description section of the details pane
            detailsPaneMore.click(() => {
                if (detailsPaneDescription.hasClass("pivot_collapsed")) {
                    detailsPaneDescription.removeClass("pivot_collapsed");
                    detailsPaneMore.text("less");
                } else {
                    detailsPaneDescription.addClass("pivot_collapsed");
                    detailsPaneMore.text("more");
                }
            });

            let currentItem: Item = null;
            let detailsPaneHideTimeout: number = null;

            // a handler to deal with showing the details pane for a particular item,
            // when the viewport is zoomed in close to that item.
            viewer.addListener("showDetails", (e: JQueryEventObject, item: Item, facets: FacetMap) => {
                if (detailsPane.hasClass("pivot_hidden")) {
                    detailsPane.removeClass("pivot_hidden");

                    // make sure the details pane won't get removed if it was fading
                    if (detailsPaneHideTimeout !== null) {
                        clearTimeout(detailsPaneHideTimeout);
                        detailsPaneHideTimeout = null;
                    }

                    // TODO move this to CSS
                    detailsPane.show();
                    setTimeout(() => {
                        detailsPane.css("opacity", 1);
                    });
                    filterPane.addClass("pivot_faded");
                }
                if (item !== currentItem) {
                    // set the title
                    detailsPaneTitle.text(item.name || "");
                    detailsPaneTitle.attr("href", item.href || "");

                    // expand the contents under the title
                    detailsPaneContent.height(legalStuff.position().top - detailsPaneContent.position().top);

                    // set the description
                    detailsPaneDescription.text(item.description || "");
                    // now it should have its layout set, so collapse description if necessary
                    if (detailsPaneDescription.outerHeight() > 80) {
                        detailsPaneMore.click();
                        detailsPaneMore.show();
                    } else {
                        detailsPaneMore.hide();
                    }

                    // go through its facets and show them
                    detailsPaneFacets.empty();
                    let itemFacets = item.facets;
                    let facetsArr = <string[]>[];
                    for (let facetName in itemFacets) {
                        let facetCategory = facets[facetName];
                        if (Helpers.hasOwnProperty(itemFacets, facetName) && facetCategory && facetCategory.isMetaDataVisible) {
                            facetsArr.push(facetName);
                        }
                    }
                    // match original order if there is one
                    facetsArr.sort((a, b) => (facets[a].index || 0) - (facets[b].index || 0));
                    for (let j = 0; j < facetsArr.length; ++j) {
                        let facetName = facetsArr[j];
                        let facetCategory = facets[facetName];
                        let facetDT = $("<dt>").addClass("pivot").text(facetName).appendTo(detailsPaneFacets);
                        let facetDD = $("<dd>").addClass("pivot").appendTo(detailsPaneFacets);
                        let facetValues = itemFacets[facetName];
                        for (let i = 0; i < facetValues.length; i++) {
                            let facetValDiv = $("<div>").appendTo(facetDD);
                            let facetValue = facetValues[i];
                            let filter: IFacetFilter = null;
                            let facetString = Helpers.getFacetString(facetValue);
                            switch (facetCategory.type) {
                                case FacetTypes.String:
                                case FacetTypes.LongString:
                                    facetValDiv.text(facetString);
                                    filter = <StringFacetFilter>{
                                        value: facetString
                                    };
                                    break;
                                case FacetTypes.Link:
                                    let href = (facetValue as LinkFacetValue).href;
                                    $("<a>").attr("target", "_blank").attr("href", href).text(facetString).appendTo(facetValDiv);
                                    filter = <LinkFacetFilter>{
                                        value: facetString
                                    };
                                    break;
                                case FacetTypes.Number:
                                    let num = (facetValue as NumberFacetValue).value;
                                    facetValDiv.text(facetString);
                                    filter = <NumberFacetFilter>{
                                        inclusive: true,
                                        upperBound: num,
                                        lowerBound: num
                                    };
                                    break;
                                case FacetTypes.DateTime:
                                    let date = (facetValue as DateFacetValue);
                                    facetValDiv.text(facetString);
                                    filter = <DateFacetFilter>{
                                        lowerBound: date.value,
                                        upperBound: new Date(date.value.getTime() + 1000)
                                    };
                                    break;
                                default:
                                    Logger.logWarning("Unrecognized facet type in details pane: " + facetCategory.type);
                                    break;
                            }
                            if (filter !== null && facetCategory.isFilterVisible) {
                                // the user should be able to click on this value to re-filter by it.
                                facetValDiv.addClass("pivot_filterable");
                                // new variable scope so we can bind to variables
                                ((() => {
                                    let facet = facetName;
                                    let values = [filter];
                                    let type = facetCategory.type;
                                    facetValDiv.click(() => {
                                        onClearAll(true);
                                        resetFilter(facet, values, type);
                                        refreshFilterPane();

                                        viewer.filter();
                                    });
                                })());
                            }
                        }
                    }
                    currentItem = item;
                }
            });

            // if the viewport zooms away from the previously selected item, it will raise a hideDetails
            // event, so we remove the details pane in response.
            viewer.addListener("hideDetails", () => {
                if (!detailsPane.hasClass("pivot_hidden")) {
                    detailsPane.addClass("pivot_hidden");

                    detailsPane.css("opacity", 0);
                    detailsPaneHideTimeout = setTimeout(function () {
                        detailsPane.hide();
                        detailsPaneHideTimeout = null;
                    }, 500); // TODO: hard-coded fading speed!
                    currentItem = null;
                    filterPane.removeClass("pivot_faded");
                }
            });

            let infoButtonHideTimeout: number = null;

            // show the info button (the collapsed version of the details pane)
            viewer.addListener("showInfoButton", () => {
                if (infoButton.hasClass("pivot_hidden")) {
                    infoButton.removeClass("pivot_hidden");

                    infoButton.show();
                    // this will css transition in supported browsers
                    setTimeout(() => {
                        infoButton.css("opacity", 1);
                    }, 0);
                    filterPane.addClass("pivot_faded");

                    // make sure the info button won't get removed if it was fading
                    if (infoButtonHideTimeout !== null) {
                        clearTimeout(infoButtonHideTimeout);
                        infoButtonHideTimeout = null;
                    }
                }
            });

            // hide the info button (the collapsed details pane)
            viewer.addListener("hideInfoButton", () => {
                if (!infoButton.hasClass("pivot_hidden")) {
                    infoButton.addClass("pivot_hidden");

                    infoButton.css("opacity", 0);
                    infoButtonHideTimeout = setTimeout(() => {
                        infoButton.hide();
                        infoButtonHideTimeout = null;
                    }, 500); // TODO: hard-coded fading speed!
                    filterPane.removeClass("pivot_faded");
                }
            });

            // the rest of the top bar stuff.
            let zoomSliderElement = $("<div>").addClass("pivot pivot_sorttools pivot_zoomslider").appendTo(topBar);
            let zoomSlider = new PivotSlider(zoomSliderElement, 0, 100, 0, "Zoom Out", "Zoom In");
            // functions for updating zoom slider from viewer and vice versa
            viewer.addListener("zoom", (e: JQueryEventObject, percent: number) => {
                zoomSlider.setValue(percent);
            });
            zoomSlider.addListener("change", (e: JQueryEventObject, value: number) => {
                viewer.zoomToPercent(value);
            });

            let graphButton = $("<div>").attr("title", "Graph View").addClass("pivot_sorttools pivot_graph pivot_hoverable").appendTo(topBar);
            let gridButton = $("<div>").attr("title", "Grid View").addClass("pivot_sorttools pivot_grid pivot_activesort").appendTo(topBar);
            graphButton.click(() => {
                if (viewer.graphView()) {
                    graphButton.removeClass("pivot_hoverable").addClass("pivot_activesort");
                    gridButton.removeClass("pivot_activesort").addClass("pivot_hoverable");
                }
            });
            gridButton.click(() => {
                if (viewer.gridView()) {
                    gridButton.removeClass("pivot_hoverable").addClass("pivot_activesort");
                    graphButton.removeClass("pivot_activesort").addClass("pivot_hoverable");
                }
            });

            // re-sort the collection when the sort box changes
            let sortBox = $("<select>").addClass("pivot pivot_sorttools").appendTo(topBar);
            sortBox.change(() => {
                viewer.sortBy(sortBox.val());
            });
            let sortLabel = $("<div>").text("Sort:").addClass("pivot_sorttools pivot_subtle").appendTo(topBar);
            // if the viewer's title is set, we'll put it in the top bar
            viewer.addListener("titleChange", (e: JQueryEventObject, text: string) => {
                title.text(text);
            });
            // if the viewer sets the copyright info, put it in the details pane
            viewer.addListener("copyright", (e: JQueryEventObject, legalInfo: ICopyrightInfo) => {
                legalStuff.html("");
                $("<a>")
                    .attr("href", legalInfo.href)
                    .attr("target", "_blank")
                    .text(legalInfo.name)
                    .appendTo(legalStuff);
            });

            let searchBox: JQuery; // the HTML input element for entering text searches
            let openFacet: JQuery; // the HTML element that is currently open for selecting filters
            let openFacetHeading: JQuery; // the HTML element that has the title of the currently open facet category
            let activeFilters: FilterDataMap; // all currently active filters, keyed by facet name
            let openFacetName: string; // the facet that has been selected in the filter pane
            let wordwheelFacets: string[]; // an array of all facet names that are visible in the word wheel
            let filtersCount: number; // the number of filters currently applied, not counting search box
            let currentSuggestion: number; // if the user uses up and down keys to access a suggested search, this value will be the index of her current selection
            let suggestionsCount: number; // the number of search suggestions currently displayed in the word wheel
            let facetVerticalSpace: number; // the height (in pixels) that can't be used by the currently open category (negative)
            let clearOption: JQuery;// the HTML element for the filter pane's "clear all" button
            let clearButtons: JQueryMap // the HTML elements for each facet's clear button, keyed by facet name
            let searchForm: JQuery; // the HTML form element containing the search box
            let activeSearch: string; // the string that we're searching for, or falsy if no current search
            let searchSuggestions: JQuery; // the HTML list containing suggested searches (word wheel)
            let searchButton: JQuery; // the HTML element you can click on to initiate a search
            let nextSearch: string; // the text the user has entered into the search box
            let openFacetType: string; // the type of facet that is open (as a string)

            // for String facets, set a filter for the given facet name to include
            // the given array of facet values, or remove the filter if the values
            // array is null or empty.
            let resetFilter = (facet: string, values?: IFacetFilter[], type?: string) => {
                let filterData = activeFilters[facet];
                if (values && values.length > 0) {
                    //setting a filter
                    if (filterData) {
                        // the filter already existed, just update its values
                        filterData.values = values;
                    } else {
                        // create a new filter
                        let filterFunc: (item: Item) => boolean;
                        switch (type) {
                            case FacetTypes.String:
                            case FacetTypes.LongString:
                            case FacetTypes.Link:
                                // string and link values use an array of string values
                                // or objects with a string content property.
                                // we can treat them pretty much the same.
                                filterFunc = (item: Item) =>
                                    filterData.values.some((value: StringFacetFilter | LinkFacetFilter) => {
                                        // find the array of string values for this facet,
                                        // keeping in mind that all facets are optional.
                                        var facetArray = item.facets[facet];
                                        if (!facetArray) {
                                            return value.value === "(no info)";
                                        }
                                        return facetArray.some((value2: StringFacetValue | LinkFacetValue) => value.value === value2.value);
                                    });
                                break;
                            case FacetTypes.DateTime:
                            case FacetTypes.Number:
                                // numbers only have one range, but DateTime filters
                                // may have several. we can treat them the same.
                                filterFunc = (item: Item) =>
                                    filterData.values.some((value: NumberFacetFilter | DateFacetFilter) => {
                                        var facetArray = item.facets[facet];
                                        if (!facetArray) {
                                            return value.lowerBound == null;
                                        }
                                        return facetArray.some((value2: NumberFacetValue | DateFacetValue) =>
                                            value2.value >= value.lowerBound &&
                                            (value.inclusive ? value2.value <= value.upperBound : value2.value < value.upperBound));
                                    });
                                break;
                            default:
                                Logger.logWarning("Unrecognized facet type " + type);
                                return;
                        }
                        filterData = activeFilters[facet] = {
                            filter: filterFunc,
                            values: values
                        };
                        viewer.addFilter(filterData.filter);
                        filtersCount++;
                        let clearButton = clearButtons[facet];
                        if (clearButton) {
                            clearButton.css("visibility", "visible");
                        }
                        if (filtersCount === 1) {
                            clearOption.css("visibility", "visible");
                        }
                    }
                } else {
                    // clearing a filter
                    if (filterData) {
                        delete activeFilters[facet];
                        viewer.removeFilter(filterData.filter);
                        filtersCount--;
                    }
                    let clearButton = clearButtons[facet];
                    if (clearButton) {
                        clearButton.css("visibility", "");
                    }
                    if (!filtersCount && !activeSearch) {
                        clearOption.css("visibility", "");
                    }
                }
            }

            // for String facets, handle a click on one of the checkboxes in the
            // currently open facet.
            let onFacetValueCheckboxClicked = (e: JQueryEventObject) => {
                let filterData = activeFilters[openFacetName];
                let facetName = openFacetName;
                let target = $(e.target);

                if (target.prop("checked")) {
                    let filter = <StringFacetFilter>{
                        value: target.attr("name")
                    };
                    if (filterData) {
                        filterData.values.push(filter);
                    } else {
                        resetFilter(facetName, [filter], openFacetType);
                    }
                } else {
                    let index = -1;
                    for (var i = 0; i < filterData.values.length; i++) {
                        var element = filterData.values[i];
                        if ((filterData.values[i] as StringFacetFilter).value == target.attr("name")) {
                            index = i;
                            break;
                        }
                    }
                    if (index !== -1) {
                        filterData.values.splice(index, 1);
                    }
                    if (!filterData.values.length) {
                        resetFilter(openFacetName);
                    }
                }

                // start the filtering operation
                viewer.filter();
            }

            // for String facets, handle a click on the facet-value label next
            // to the checkbox.
            let onFacetValueNameClicked = (e: JQueryEventObject) => {
                let filterData = activeFilters[openFacetName];
                let checkBox = $(e.target).parent().prev();
                checkBox.prop("checked", true);
                let name = checkBox.attr("name");
                if (!filterData) {
                    // this is the first name clicked in this tab, so it
                    // will act the same as the checkbox
                    onFacetValueCheckboxClicked(<any>{
                        target: checkBox[0]
                    });
                } else {
                    // reset the checkboxes
                    openFacet.children().last().children().each((idx, elem) => {
                        let chk = $(elem).children().first();
                        if (chk.attr("name") !== name) {
                            chk.prop("checked", false);
                        }
                    });
                    // update the filter
                    filterData.values = [<StringFacetFilter>{ value: name }];
                    // push the update into the viewer
                    viewer.filter();
                }
            }

            // handle a range filter being applied by the user messing with the number slider.
            let onNumberRangeSet = (facet: string, min: number, max: number, inclusive: boolean) => {
                let value = <NumberFacetFilter>{
                    lowerBound: min,
                    upperBound: max,
                    inclusive: inclusive
                };
                resetFilter(facet, [value], "Number");
                viewer.filter();
            }

            // handle a range filter being removed from the number slider
            let onNumberRangeUnset = (facet: string) => {
                resetFilter(facet);
                viewer.filter();
            }

            // handle a modification to the open datetime facet's filters
            let onDateRangeSet = (facet: string, values: IFacetFilter[]) => {
                resetFilter(facet, values, "DateTime");
                viewer.filter();
            }

            // comparator functions for sorting string facets
            let compareByQuantity = (a: ISortableFacetValue<string>, b: ISortableFacetValue<string>) => {
                return b.count - a.count;
            }
            let compareAlphabetical = (a: ISortableFacetValue<string>, b: ISortableFacetValue<string>) => {
                let aVal = a.value;
                let bVal = b.value;
                if (aVal === bVal)
                    return 0;
                if (aVal === "(no info)")
                    return 1;
                if (bVal === "(no info)")
                    return -1;
                if (aVal > bVal)
                    return 1;
                return -1;
            }

            // handle a click on the button that changes sort order for the currently open string facet
            let onSortLabelClick = () => {
                openFacetHeading.data("currentComparator",
                    (openFacetHeading.data("currentComparator") + 1) % openFacetHeading.data("comparators").length);
                refreshFilterPane();
            }

            // handle a click on one of the facet headings in the filter pane.
            // it should close the open facet, if there was one, and then open up
            // filtering options for the newly selected facet.
            let onFacetClicked = (e: JQueryEventObject) => {
                if (openFacet) {
                    openFacet.css({ height: 0, overflow: "hidden" });
                }
                var target = $(e.target);
                if (!target.attr("name")) {
                    target = target.parent();
                }
                openFacetHeading = target;
                openFacetName = target.attr("name");
                openFacetType = target.data("facetType");
                var nextSibling = target.next();
                nextSibling.html("");

                // add selection options to this facet, based on the counts for all
                // items in the collection, not counting filters selected in this facet.
                var currentFilter = activeFilters[openFacetName] || <FilterData>{};
                var items = viewer.runFiltersWithout(currentFilter.filter);
                switch (openFacetType) {
                    case FacetTypes.Link:
                    case FacetTypes.String:
                    case FacetTypes.LongString:
                        // start by counting all occurences of each value for this facet
                        let facetValues = <NumberMap>{}; // keyed by facet value, each value is a count of frequency
                        let countFacetValue = (facetValue: IFacetValue<any>) => {
                            // check for the link type's content property, since we're treating
                            // them just like string values otherwise.
                            let value = Helpers.getFacetString(facetValue);
                            if (!facetValues[value]) {
                                facetValues[value] = 0;
                            }
                            facetValues[value]++;
                        };
                        items.forEach((item: Item) => {
                            if (item.facets[openFacetName]) {
                                item.facets[openFacetName].forEach(countFacetValue);
                            } else {
                                countFacetValue(<StringFacetValue>{
                                    value: "(no info)"
                                });
                            }
                        });

                        // next, sort them based on the current sort order
                        let facetValuesArray = <StringFacetValue[]>[];
                        for (let value in facetValues) {
                            if (Helpers.hasOwnProperty(facetValues, value)) {
                                facetValuesArray.push({
                                    value: value,
                                    count: facetValues[value]
                                });
                            }
                        }
                        facetValuesArray.sort(target.data("comparators")[target.data("currentComparator")]);

                        // finally, add the UI elements to select these facets
                        let sortOrderLabel = $("<div>")
                            .text(target.data("comparatorNames")[target.data("currentComparator")])
                            .addClass("pivot_sortlabel")
                            .appendTo(nextSibling)
                            .click(() => onSortLabelClick());
                        let facetOptions = $("<ul>").addClass("pivot").appendTo(nextSibling);
                        let currentFilterValues = currentFilter.values || <IFacetFilter[]>[];
                        facetValuesArray.forEach((value) => {
                            let stringValue = value.value;
                            let facetOption = $("<li>").appendTo(facetOptions);
                            let checkBox = $("<input>")
                                .attr("type", "checkbox")
                                .attr("name", stringValue)
                                .addClass("pivot pivot_facetcheckbox")
                                .prop("checked", currentFilterValues.some((fv: StringFacetFilter) => fv.value === value.value))
                                .appendTo(facetOption)
                                .click((e: JQueryEventObject) => onFacetValueCheckboxClicked(e));
                            let outerLabel = $("<div>")
                                .addClass("pivot_outerlabel")
                                .appendTo(facetOption)
                                .click((e: JQueryEventObject) => onFacetValueNameClicked(e));
                            let count = $("<div>")
                                .addClass("pivot_facetcount")
                                .text(value.count)
                                .appendTo(outerLabel);
                            let label = $("<div>")
                                .addClass("pivot_facetlabel")
                                .attr("title", stringValue)
                                .text(stringValue)
                                .appendTo(outerLabel);
                        });
                        break;
                    case FacetTypes.Number:
                        //    var numberPicker = new PivotNumberPicker(nextSibling, items, openFacetName, currentFilter.values);
                        //    numberPicker.addListener("filter", onNumberRangeSet);
                        //    numberPicker.addListener("unfilter", onNumberRangeUnset);
                        break;
                    case FacetTypes.DateTime:
                        var datePicker = new PivotDatePicker(nextSibling, items, openFacetName, currentFilter.values);
                        datePicker.addListener("filter", (e: JQueryEventObject, facet: string, values: IFacetFilter[]) => onDateRangeSet(facet, values));
                        break;
                    default:
                        Logger.logWarning("Unrecognized facet type: " + openFacetType);
                        break;
                }

                // now open up the facet
                nextSibling.css({
                    height: Math.max(150, filterPane.height() + facetVerticalSpace) + "px",
                    overflowY: "auto"
                });
                openFacet = nextSibling;
            }

            // update the filter pane, due to another filter being applied somewhere.
            // this should make the filter pane display new values for quantity,
            // rearrange checkboxes, etc.
            let refreshFilterPane = () => {
                if (openFacet) {
                    onFacetClicked(<any>{
                        target: openFacet.prev()[0]
                    });
                }
            }

            // we may need to adjust filter pane heights when the viewer is resized
            viewer.addListener("resize", refreshFilterPane);

            // handle a click on a clear button
            let onClear = (e: JQueryEventObject) => {
                //    resetFilter(e.target.parentNode.name);
                //    viewer.filter();
                //    refreshFilterPane();
                //    e.stopPropagation();
            }

            // From the Viewer's perspective, any filter is just a function that can be applied
            // to items and returns true or false. This is the filter that is run to select
            // items based on text search.
            let searchFilter = (item: Item) => {
                var facets = item.facets;
                var searchTerms = activeSearch.trim().toLowerCase().split(" ");
                return searchTerms.every((searchTerm: string) => {
                    return item.name.toLowerCase().indexOf(searchTerm) !== -1 || wordwheelFacets.some((facet) => {
                        var facetData = facets[facet];
                        return facetData && facetData.some((value) => Helpers.getFacetString(value).toLowerCase().indexOf(searchTerm) !== -1);
                    });
                });
            }

            // update the search box to whatever state it would be in if the user
            // weren't currently interacting with it. If a search is currently active,
            // the search box will show the string we searched for and the clear button
            // will be present. If no search is currently active, the box will show a
            // watermark and the search button will be disabled.
            let onSearchBlur = () => {
                if (activeSearch) {
                    searchBox.val(activeSearch);
                    searchButton.addClass("pivot_clrsearch");
                    searchButton[0].onmousedown = () => clearSearch(); // TODO
                } else {
                    searchForm.addClass("pivot_watermark");
                    searchBox.val("Search...");
                    searchButton[0].onmousedown = null; // TODO
                }
                searchSuggestions.html("");
                currentSuggestion = -1;
                suggestionsCount = 0;
            }

            // clear the current text-search filter from the viewer. this function will also
            // start the viewer's rearrange step unless the wait parameter is true.
            let clearSearch = (wait?: boolean) => {
                searchButton.removeClass("pivot_clrsearch");
                activeSearch = null;
                if (!filtersCount) {
                    clearOption.css("visibility", "");
                }
                onSearchBlur();
                viewer.removeFilter(searchFilter);
                if (wait !== true) {
                    viewer.filter();
                    refreshFilterPane();
                }
            }

            // handle a click on the "clear all" button
            let onClearAll = (wait?: boolean) => {
                viewer.clearFilters();
                for (let facetName in clearButtons) {
                    if (Helpers.hasOwnProperty(clearButtons, facetName)) {
                        clearButtons[facetName].css("visibility", "");
                    }
                }
                if (activeSearch) {
                    clearSearch(true);
                }
                clearOption.css("visibility", "");
                activeFilters = <FilterDataMap>{};
                filtersCount = 0;
                if (wait !== true) {
                    viewer.filter();
                    refreshFilterPane();
                }
            }

            // this event is only raised for filter changes that originate inside the viewer,
            // such as clicking on a bar of the graph view. it is the way that the viewer can
            // request a filter to be applied to itself. by using this model, we keep filter
            // management together in one place (here), even though the viewer occasionally
            // has to ask for filters. in response, we must create the requested filter and
            // apply it.
            viewer.addListener("filterrequest", function (e: JQueryEventObject, newFilter: FilterData) {
                //    var facetType = newFilter.type,
                //        filterValues = newFilter.values;
                //    // we have to update our representation of active filters
                //    resetFilter(newFilter.facet, filterValues, facetType);
                //    if ((facetType === FacetTypes.String || facetType === FacetTypes.Link || facetType === FacetTypes.LongString) &&
                //            filterValues.length === 1) {
                //        // numbers and dates re-bucketize and look awesome, but strings don't
                //        if (viewer.gridView()) {
                //            makeViewSelected(gridButton);
                //            makeViewClickable(graphButton);
                //        }
                //    } else {
                //        viewer.filter();
                //    }
                //    // refresh the view
                //    refreshFilterPane();
            });

            // build a filter for the current contents of the search box,
            // and apply it in the viewer.
            let onSearch = () => {
                var wasActive = !!activeSearch;
                activeSearch = searchBox.val();
                if (!wasActive) {
                    viewer.addFilter(searchFilter);
                }
                clearOption.css("visibility", "visible");
                onSearchBlur();
                viewer.filter();
                refreshFilterPane();
            }

            // add results to the word wheel. the results parameter is an object,
            // keyed by string result, where the values are the quantity of each
            // result. in this function, we sort those results so that the most
            // popular ones come first, and add them to the word wheel. we stop
            // adding results once the word wheel fills up (10 results). this
            // function can be called multiple times with multiple batches of results.
            let addSearchResults = (searchTerm: string, count: number, results: string[]) => {
                let length = Math.min(results.length, count);
                for (let i = 0; i < length; i++) {
                    let result = results[i];

                    let termStart = result.toLowerCase().indexOf(searchTerm.toLowerCase());
                    let termEnd = termStart + searchTerm.length;
                    let first = result.substring(0, termStart)
                    let bold = result.substring(termStart, termEnd)
                    let last = result.substring(termEnd, result.length)

                    $("<li>")
                        .appendTo(searchSuggestions)
                        .append(first)
                        .append($("<strong>").text(bold))
                        .append(last)
                        .mousedown(() => {
                            searchBox.val(result);
                            onSearch();
                        });
                }
                return length;
            }

            // change the currently selected suggestion in the word wheel to
            // the suggestion with the provided index. an index of -1 means go
            // back to whatever the user typed.
            let updateSuggestion = (nextSuggestion: number) => {
                let highlighted = $(searchSuggestions.children()[currentSuggestion]);
                highlighted.removeClass("pivot_highlight");

                // clamp the suggestion index to the allowed range
                currentSuggestion = nextSuggestion;
                if (currentSuggestion >= suggestionsCount) {
                    currentSuggestion = -1;
                } else if (currentSuggestion < -1) {
                    currentSuggestion = suggestionsCount - 1;
                }

                // update the search box
                if (currentSuggestion === -1) {
                    searchBox.val(nextSearch);
                } else {
                    highlighted = $(searchSuggestions.children()[currentSuggestion]);
                    highlighted.addClass("pivot_highlight");
                    searchBox.val(highlighted.text());
                }
            }

            // handle a keyup event in the search box. for most keys, we'll get a
            // new list of suggestions in response. for the down and up keys, we'll
            // cycle through the current suggestions.
            let onSearchKeyPress = (e?: JQueryKeyEventObject) => {
                let keycode = e ? e.keyCode : -1;
                switch (keycode) {
                    case 38: // up arrow
                        updateSuggestion(currentSuggestion - 1);
                        break;
                    case 40: // down arrow
                        updateSuggestion(currentSuggestion + 1);
                        break;
                    case 13: // enter. it'll submit the form, but let's unfocus the text box first.
                        inputElmt.focus();
                        break;
                    default:
                        nextSearch = searchBox.val();
                        var searchResults = viewer.runSearch(nextSearch);
                        searchSuggestions.html("");
                        currentSuggestion = -1;
                        suggestionsCount = addSearchResults(nextSearch, 15, searchResults);
                        break;
                }
            }

            // handle a focus event on the searchbox
            function onSearchFocus() {
                if (activeSearch) {
                    searchButton.removeClass("pivot_clrsearch");
                    // pop up the suggestions as if we had pressed a key
                    onSearchKeyPress();
                } else {
                    searchForm.removeClass("pivot_watermark");
                    searchBox.val("");
                }
                /* note that this must be on mousedown, not onclick!
                   mousedown on this element happens before blur on the text box,
                   but before click on this element. we change the text box's contents
                   on blur, so using mousedown is the easiest solution. */
                searchButton[0].onmousedown = onSearch;
            }

            // unfortunately, we can't serialize the activeFilters object directly because it's full of
            // functions, DOM objects, and things that don't serialize cleanly, so manually run through
            // it, copying useful stuff into another object, and serialize that copy.
            let serializeFilters = () => {
                //    var filtersCopy = {}, facetName;
                //    for (facetName in activeFilters) {
                //        if (hasOwnProperty.call(activeFilters, facetName)) {
                //            var originalValues = activeFilters[facetName].values;
                //            var valuesCopy = [];
                //            var dataType;
                //            var i, n = originalValues.length;
                //            for (i = 0; i < n; ++i) {
                //                var value = originalValues[i];
                //                if (typeof value === "string") {
                //                    valuesCopy.push(value);
                //                    dataType = "String";
                //                } else {
                //                    // assume it's a range, either numbers or dates
                //                    var lowerBound = value.lowerBound;
                //                    var upperBound = value.upperBound;
                //                    if (typeof lowerBound !== "number" && typeof upperBound !== "number") {
                //                        // not a number, must be dates
                //                        lowerBound = lowerBound.getTime();
                //                        upperBound = upperBound.getTime();
                //                        dataType = "DateTime";
                //                    } else {
                //                        dataType = "Number";
                //                    }
                //                    valuesCopy.push({
                //                        lowerBound: lowerBound,
                //                        upperBound: upperBound,
                //                        inclusive: value.inclusive
                //                    });
                //                }
                //            }
                //            filtersCopy[facetName] = {
                //                values: valuesCopy,
                //                dataType: dataType
                //            };
                //        }
                //    }
                return JSON.stringify({
                    //        filters: filtersCopy,
                    //        search: activeSearch,
                    //        sortBy: sortBox.value,
                    //        view: (gridButton.className.indexOf("pivot_activesort") !== -1) ? "grid" : "graph"
                });
            }

            // apply a serialized set of filters. currently assumes that the viewer state is fresh
            // (no filters applied yet, in grid view mode)
            let deserializeFilters = (filterData: string) => {
                //    filterData = JSON.parse(filterData);
                //    var filters = filterData.filters;
                //    var search = filterData.search;
                //    var sortBy = filterData.sortBy;
                //    var facetName;
                //    for (facetName in filters) {
                //        if (hasOwnProperty.call(filters, facetName)) {
                //            var filter = filters[facetName];
                //            var dataType = filter.dataType;
                //            var values = filter.values;
                //            if (dataType === "DateTime") {
                //                // we have to do some cleanup from the serialized version
                //                values.forEach(function (value) {
                //                    value.lowerBound = new Date(value.lowerBound);
                //                    value.upperBound = new Date(value.upperBound);
                //                });
                //            }
                //            if (dataType === "Number") {
                //                // and number filters need infinite values, but get serialized as null
                //                values.forEach(function (value) {
                //                    if (value.lowerBound == null) {
                //                        value.lowerBound = -Infinity;
                //                    }
                //                    if (value.upperBound == null) {
                //                        value.upperBound = Infinity;
                //                    }
                //                });
                //            }
                //            resetFilter(facetName, values, dataType);
                //        }
                //    }
                //    if (search) {
                //        searchBox.value = search;
                //        onSearch();
                //    }
                //    if (sortBy) {
                //        sortBox.value = sortBy;
                //        viewer.sortBy(sortBy);
                //    }
                //    if (filterData.view === "graph") {
                //        graphButton.onclick();
                //    }
                //    refreshFilterPane();
            }

            // once we know about facets for the collection, we can build
            // the rest of the UI. note that this can be reset at any time,
            // if the current facets change. if the facets change, we expect
            // the viewer to have already dropped any filters that had been active,
            // so that all items are filtered in at this point.
            viewer.addListener("facetsSet", function (e: JQueryEventObject, facets: FacetMap) {
                // set up the sorting options
                wordwheelFacets = [];
                sortBox.html("");
                for (let name in facets) {
                    if (Helpers.hasOwnProperty(facets, name)) {
                        if (facets[name].isFilterVisible) {
                            $("<option>").text(name).val(name).appendTo(sortBox);
                        }
                        if (facets[name].isWordWheelVisible) {
                            wordwheelFacets.push(name);
                        }
                    }
                }
                // tell the viewer which sort option we're using first
                viewer.sortBy(sortBox.val());

                // reset state variables
                activeFilters = <FilterDataMap>{};
                filtersCount = 0;
                currentSuggestion = -1;
                suggestionsCount = 0;
                activeSearch = null;
                nextSearch = null;
                openFacet = null;
                openFacetName = "";
                openFacetType = null;

                // fill out the filter pane:
                // the clear all
                filterPane.html("");
                clearButtons = <JQueryMap>{};
                clearOption = $("<div>")
                    .text("Clear All")
                    .addClass("pivot_clrlabel pivot_clr")
                    .appendTo(filterPane)
                    .click(() => onClearAll());
                $("<div>").html("&times;").addClass("pivot_clrbtn pivot_clr").appendTo(clearOption);

                // the search box
                searchForm = $("<form>")
                    .addClass("pivot pivot_searchform")
                    .appendTo(filterPane)
                    .submit((e: JQueryEventObject) => {
                        onSearch();
                        e.preventDefault();
                    });
                searchBox = $("<input>").attr("type", "text").addClass("pivot_searchbox").appendTo(searchForm);
                searchBox.focus(() => onSearchFocus());
                searchBox.blur(() => onSearchBlur());
                searchBox.keyup((e) => onSearchKeyPress(e));
                searchButton = $("<span>").html("&times;").addClass("pivot_searchbtn").appendTo(searchForm);
                searchSuggestions = $("<ul>").addClass("pivot pivot_results").appendTo(searchForm);
                onSearchBlur();

                let facetsArr = <string[]>[];
                for (let name in facets) {
                    if (Helpers.hasOwnProperty(facets, name) && facets[name].isFilterVisible) {
                        facetsArr.push(name);
                    }
                }
                // make sure they go in the order that the CXML specified them, if any
                facetsArr.sort((a: string, b: string) => {
                    return (facets[a].index || 0) - (facets[b].index || 0);
                });

                facetVerticalSpace = -10 - searchForm.outerHeight() - clearOption.outerHeight();

                for (let i = 0; i < facetsArr.length; ++i) {
                    let name = facetsArr[i];
                    let facet = facets[name];
                    let facetHeading = $("<div>")
                        .attr("name", name)
                        .data("facetType", facet.type)
                        .addClass("pivot pivot_facetname")
                        .appendTo(filterPane)
                        .click((e: JQueryEventObject) => onFacetClicked(e));

                    if (facet.type === FacetTypes.String || facet.type === FacetTypes.LongString || facet.type === FacetTypes.Link) {
                        // set up a few variables so we can keep track of our sorting order
                        let comparatorNames = <string[]>[];
                        facetHeading.data("comparatorNames", comparatorNames);
                        let comparators = <SortableFacetValueComparator[]>[];
                        facetHeading.data("comparators", comparators);
                        facetHeading.data("currentComparator", 0);

                        if (facet.orders && facet.orders.length && facet.comparator) {
                            // we'll only support one custom sort order for now, because that's what pivot
                            // seems to do. if we need to support more, we could.
                            ((() => {
                                let temp = facet.comparator;
                                comparators.push((a, b) => {
                                    return temp(a.value, b.value);
                                });
                            })());
                            comparatorNames.push("Sort: " + facet.orders[0].name);
                        }
                        comparatorNames.push("Sort: Quantity");
                        comparators.push(compareByQuantity);
                        comparatorNames.push("Sort: A to Z");
                        comparators.push(compareAlphabetical);
                    }

                    let clearButton = $("<div>")
                        .html("&times;")
                        .addClass("pivot_clrbtn pivot_clr")
                        .appendTo(facetHeading)
                        .click((e: JQueryEventObject) => onClear(e));
                    clearButtons[name] = clearButton;
                    $("<div>").text(name).addClass("pivot_facetlabel").appendTo(facetHeading);

                    facetVerticalSpace -= facetHeading.outerHeight();

                    $("<div>").height(0).css("overflow", "hidden").addClass("pivot pivot_facetvalues").appendTo(filterPane);
                }

                // apply filters from the hash immediately
                if (useHash) {
                    var hash = location.hash;
                    if (hash && hash.length > 2) {
                        try {
                            deserializeFilters(decodeURIComponent(hash.substr(1)));
                        } catch (e) {
                            Logger.logWarning("bad URL hash");
                        }
                    }
                }
            });

            // any time the user interacts with the viewer, focus the offscreen text box so we can catch directional arrows
            div.click("click", (e: JQueryEventObject) => {
                var target = e.target;
                if (target !== searchBox[0] && target !== sortBox[0]) {
                    inputElmt.focus();
                }
            });

            // put the current filter state in the hash after any rearrange operation
            if (useHash) {
                viewer.addListener("finishedRearrange", (e: JQueryEventObject) => {
                    location.hash = "#" + encodeURIComponent(serializeFilters());
                });
            }

            return viewer;
        }
    }

}
