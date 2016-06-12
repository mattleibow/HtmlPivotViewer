
namespace Pivot {

    export class Item {
        id: string;
        href: string;
        name: string;
        img: string;
        description: string;
        facets: FacetListMap;
        sdimg: DeepZoomImage[];

        constructor(id: string) {
            this.id = id;
            this.facets = {};
        }
    }

    export interface IFacetValue<T> {
        value: T;
    }

    export interface ISortableFacetValue<T> extends IFacetValue<T> {
        count: number;
    }

    export interface StringFacetValue extends IFacetValue<string>, ISortableFacetValue<string> {
        value: string;
        count: number;
    }

    export interface UnknownFacetValue extends IFacetValue<string>, ISortableFacetValue<string> {
        value: string;
        count: number;
    }

    export interface NumberFacetValue extends IFacetValue<number>, ISortableFacetValue<number> {
        value: number;
        count: number;
    }

    export interface DateFacetValue extends IFacetValue<Date> {
        value: Date;
    }

    export interface LinkFacetValue extends IFacetValue<string> {
        value: string;
        href: string;
    }

    export type FacetType = "String" | "LongString" | "Link" | "Number" | "DateTime";

    export class FacetTypes {
        static String: FacetType = "String";
        static LongString: FacetType = "LongString";
        static Link: FacetType = "Link";
        static Number: FacetType = "Number";
        static DateTime: FacetType = "DateTime";
    }

    export class Facet {
        name: string;
        index: number;
        type: FacetType;
        isFilterVisible: boolean;
        isMetaDataVisible: boolean;
        isWordWheelVisible: boolean;
        orders: SortOrder[];
        comparator: StringComparator;

        constructor(name: string) {
            this.name = name;
            this.orders = <SortOrder[]>[];
        }
    }

    export interface LegalInfo {
        name: string;
        href: string;
    }

    export interface StringComparator {
        (a: string, b: string): number;
    }

    export interface ItemFilter {
        (item: Item): boolean;
    }

    export interface SortableFacetValueComparator {
        (a: ISortableFacetValue<string>, b: ISortableFacetValue<string>): number;
    }

    export interface SortOrder {
        name: string;
        order: string[];
    }

    export interface FacetMap {
        [name: string]: Facet;
    }

    export interface FacetListMap {
        [name: string]: IFacetValue<any>[];
    }

    export interface FilterData {
        filter: ItemFilter;
        values: IFacetFilter[];
    }

    export interface FilterDataMap {
        [name: string]: FilterData;
    }

    export interface JQueryMap {
        [name: string]: JQuery;
    }

    export interface NumberMap {
        [name: string]: number;
    }

    export interface ItemMap {
        [id: string]: Item;
    }


    export interface IFacetFilter {
        leftLabel: string;
        rightLabel: string;
        label: string;
        count: number; // TODO - is this right here? ie: is it always added?
        items: Item[];
    }

    export interface StringFacetFilter extends IFacetFilter {
        value: string;
    }

    export interface LinkFacetFilter extends IFacetFilter {
        value: string;
    }

    export interface NumberFacetFilter extends IFacetFilter {
        upperBound: number;
        lowerBound: number;
        inclusive: boolean;
    }

    export interface DateFacetFilter extends DateBucket, IFacetFilter {
        checkbox: JQuery;
    }


    export interface DateBucket {
        upperBound: Date;
        lowerBound: Date;
        leftLabel: string;
        rightLabel: string;
        label: string;
    }


    export interface ICopyrightInfo {
        name: string;
        href: string;
    }

}
