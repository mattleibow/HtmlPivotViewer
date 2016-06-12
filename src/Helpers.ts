///<reference path="../typings/index.d.ts" />

namespace Pivot {

    export class Helpers {
        static hasOwnPropertyFunction = ({}.hasOwnProperty);
        static epsilon = 1e-5;

        static isCanvasSupported() {
            var elem = document.createElement('canvas');
            return !!(elem.getContext && elem.getContext('2d'));
        }
        static hasOwnProperty(obj: any, prop: string) {
            return Helpers.hasOwnPropertyFunction.call(obj, prop);
        }

        // Format a number, assuming it's supposed to be a decimal value.
        // This means we'll try to avoid outputting anything with long strings
        // of zeros or nines, since those are usually arithmetic errors.
        // TODO Pivot numbers need a lot more formatting than this: CXML
        // often specifies custom format strings in the .net ToString style, and
        // a proper implementation would be aware of its locale.
        static formatNumber(num: number): string {
            // check for zero values so we can avoid taking the log of it
            if (!num) {
                return "0";
            }

            // now we count the significant digits
            let scale = Math.floor(Math.log(Math.abs(num)) / Math.LN10);
            let y = num / Math.pow(10, scale);
            let digits = 0;
            while (digits < 10 && Math.abs(y) > Helpers.epsilon) {
                digits++;
                y = (y - Math.round(y)) * 10;
            }

            // return a string containing the right number of significant digits.
            // we'll try to avoid exponential notation for smallish numbers, because
            // 1.2e+2 just looks silly.
            if (scale >= digits && scale < digits + 5) {
                return num.toFixed(0);
            } else {
                return num.toPrecision(digits);
            }
        }

        static getFacetString(facetValue: IFacetValue<any>) {
            let value = facetValue.value;
            // deal with Number and Date types
            if (typeof value === "number") {
                value = Helpers.formatNumber(value as number);
            } else if (value instanceof Date) {
                value = (value as Date).toLocaleDateString() + " " + (value as Date).toLocaleTimeString();
            }
            return value as string;
        }

        static addListener(object: any, event: string, handler: (eventObject: JQueryEventObject, ...eventData: any[]) => any) {
            $(object).on(event, handler);
        }

        static trigger(object: any, event: string, eventData?: any[]) {
            $(object).trigger(event, eventData);
            console.debug("send event: '" + event + "'");
        }
    }

}
