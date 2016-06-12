
namespace Pivot {

    export class PivotDatePicker {
        facetName: string;
        currentFilterValues: IFacetFilter[];
        list: JQuery;

        constructor(optionsDiv: JQuery | HTMLElement, items: Item[], facetName: string, currentFilterValues: IFacetFilter[]) {
            this.facetName = facetName;
            this.currentFilterValues = currentFilterValues || <IFacetFilter[]>[];

            optionsDiv = $(optionsDiv);

            // calculate max and min
            let min: Date = null; // the earliest date in the set of items
            let max: Date = null; // the latest date in the set of items
            items.forEach((item) => {
                var facetValues = item.facets[facetName];
                if (facetValues) {
                    facetValues.forEach((value) => {
                        if (max == null || value.value > max) {
                            max = value.value;
                        }
                        if (min == null || value.value < min) {
                            min = value.value;
                        }
                    });
                }
            });

            if (min == null) {
                // none of the items have this facet set
                $("<div>")
                    .text("Not Currently Applicable")
                    .addClass("pivot_numberlabel")
                    .appendTo(optionsDiv);
            } else {
                // figure out what scale of time to use for filtering
                // the size of date span to use (see Date.js for enum values)
                let scale = DateHelpers.chooseDateScale(min, max);

                // generate buckets
                // the filtering buckets for the default time scale
                let buckets = DateHelpers.generateBuckets(min, max, scale) as DateFacetFilter[];
                // the filtering buckets for the next more specific scale (e.g. months instead of years)
                let moreBuckets = DateHelpers.generateBuckets(min, max, scale - 1) as DateFacetFilter[];
                // an array containing both of the previous
                let allBuckets = buckets.concat(moreBuckets);

                // count the number of results for each range
                allBuckets.forEach((bucket) => {
                    bucket.count = 0;
                    bucket.items = [];
                });
                items.forEach((item: Item) => {
                    var facetValues = item.facets[facetName];
                    if (facetValues) {
                        facetValues.forEach((value) => {
                            allBuckets.forEach((bucket) => {
                                if (value.value >= bucket.lowerBound && value.value < bucket.upperBound) {
                                    bucket.count++;
                                }
                            });
                        });
                    }
                });

                // make some HTML
                // an HTML ul element containing all of the filtering options
                this.list = $("<ul>")
                    .addClass("pivot")
                    .appendTo(optionsDiv)
                    .append($("<li>").addClass("pivot_horizbar"));
                buckets.forEach(this.makeBucketUI);
                moreBuckets.forEach((bucket: DateFacetFilter) => this.makeBucketUI(bucket));
            }
        }

        // handle a click on a checkbox
        onFacetValueCheckboxClicked(e: JQueryEventObject) {
            var target = $(e.target);
            if (target.prop("checked")) {
                // add the filter
                this.currentFilterValues.push(target.data("filterInfo") as DateFacetFilter);
                this.trigger("filter", [this.facetName, this.currentFilterValues]);
            } else {
                // remove the filter
                this.currentFilterValues.splice(this.currentFilterValues.indexOf(target.data("filterInfo") as DateFacetFilter), 1);
                this.trigger("filter", [this.facetName, this.currentFilterValues.length ? this.currentFilterValues : undefined]);
            }
        }

        // handle a click on a label
        onFacetValueNameClicked(e: JQueryEventObject) {
            var bucket = $(e.target).data("filterInfo") as DateFacetFilter;

            // uncheck all boxes that were already checked
            this.currentFilterValues.forEach((bucket: DateFacetFilter) => {
                bucket.checkbox.prop("checked", false);
            });

            // check the new box
            bucket.checkbox.prop("checked", true);

            // set only the new filter
            this.currentFilterValues = [bucket];
            this.trigger("filter", [this.facetName, this.currentFilterValues]);
        }

        // this function will add UI selection elements for the given range.
        // similar to the setup steps for string facets.
        makeBucketUI(bucket: DateFacetFilter) {
            let facetOption = $("<li>")
                .attr("title", bucket.label)
                .appendTo(this.list);
            let checkBox = $("<input>")
                .attr("type", "checkbox")
                .addClass("pivot pivot_facetcheckbox")
                .data("filterInfo", bucket)
                .appendTo(facetOption)
                .click((e: JQueryEventObject) => this.onFacetValueCheckboxClicked(e));

            // check whether the current filter has already been applied
            if (this.currentFilterValues) {
                let some = this.currentFilterValues.some((range: DateFacetFilter, index: number) => {
                    if (range.lowerBound.getTime() === bucket.lowerBound.getTime() && range.upperBound.getTime() === bucket.upperBound.getTime()) {
                        this.currentFilterValues[index] = bucket;
                        return true;
                    }
                    return false;
                });

                if (some) {
                    checkBox.prop("checked", true);
                }
            }

            // keep a reference to the checkbox that we can easily get to without DOM traversals
            bucket.checkbox = checkBox;

            // any of the UI elements we create should be able to easily reference the range they represent
            let outerLabel = $("<div>")
                .addClass("pivot_outerlabel")
                .data("filterInfo", bucket)
                .appendTo(facetOption)
                .click((e: JQueryEventObject) => this.onFacetValueNameClicked(e));
            let count = $("<div>")
                .addClass("pivot_facetcount")
                .text(bucket.count)
                .data("filterInfo", bucket)
                .appendTo(outerLabel);
            let label = $("<div>")
                .addClass("pivot_facetlabel")
                .text(bucket.label)
                .data("filterInfo", bucket)
                .appendTo(outerLabel);
        }

        addListener(event: string, handler: (eventObject: JQueryEventObject, ...eventData: any[]) => any) {
            Helpers.addListener(this, event, handler);
        }

        trigger(event: string, eventData?: any[]) {
            Helpers.trigger(this, event, eventData);
        }
    }

    const enum DateScale {
        MaxScale = 0,

        Month = -1,
        HalfMonth = -2,
        Day = -3,
        HalfDay = -4,
        Hour = -5,
        QuarterHour = -6,
        Minute = -7,
        FiveSeconds = -8,
        Second = -9,

        MinimumScale = -9
    }

    class DateHelpers {

        static months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ]

        static getHalfMonth(month: number) {
            return month === 1 ? 15 : 16;
        }

        // choose the granularity for bucketing by dates. return value will be an integer:
        // if positive, it is an integer n where buckets should be 10^n years; otherwise, 
        // -1 : month
        // -2 : half-month
        // -3 : day
        // -4 : half-day
        // -5 : hour
        // -6 : 15 minutes
        // -7 : minute
        // -8 : 5 seconds
        // -9 : second
        static chooseDateScale(min: Date, max: Date): DateScale {
            let difference = max.getFullYear() - min.getFullYear();
            if (difference) {
                // it'll be by year, we just have to decide how many of them
                return Math.floor(Math.log(difference) / Math.LN10);
            }
            let month = max.getMonth();
            if (month > min.getMonth()) {
                return DateScale.Month;
            }
            let upper = max.getDate();
            let lower = min.getDate();
            let threshold = DateHelpers.getHalfMonth(month);
            if (lower < threshold && upper >= threshold) {
                return DateScale.HalfMonth;
            }
            if (upper > lower) {
                return DateScale.Day;
            }
            difference = max.getHours() - min.getHours();
            if (difference >= 12) {
                return DateScale.HalfDay;
            }
            if (difference) {
                return DateScale.Hour;
            }
            difference = max.getMinutes() - min.getMinutes();
            if (difference >= 15) {
                return DateScale.QuarterHour;
            }
            if (difference) {
                return DateScale.Minute;
            }
            difference = max.getSeconds() - min.getSeconds();
            if (difference >= 5) {
                return DateScale.FiveSeconds;
            }
            return DateScale.Second;
        }

        static generateBuckets(min: Date, max: Date, scale?: DateScale): DateBucket[] {
            if (!(min <= max) || scale < DateScale.MinimumScale) {
                // nothing we can do here
                return [];
            }
            if (scale == null) {
                scale = DateHelpers.chooseDateScale(min, max);
            }
            if (scale >= 0) {
                scale = Math.pow(10, scale);
            }
            let year = min.getFullYear();
            let month = 0;
            let date = 1;
            let hours = 0;
            let minutes = 0;
            let seconds = 0;
            let milliseconds = 0;

            // shift the minimum to a nice boundary, based on the scale we chose
            if (scale >= DateScale.MaxScale) {
                year = Math.floor(year / scale) * scale;
            } else {
                if (scale >= DateScale.Second) {
                    seconds = min.getSeconds();
                } else if (scale >= DateScale.FiveSeconds) {
                    seconds = Math.floor(min.getSeconds() / 5) * 5;
                }
                if (scale >= DateScale.Minute) {
                    minutes = min.getMinutes();
                } else if (scale >= DateScale.QuarterHour) {
                    minutes = Math.floor(min.getMinutes() / 15) * 15;
                }
                if (scale >= DateScale.Hour) {
                    hours = min.getHours();
                } else if (scale >= DateScale.HalfDay) {
                    hours = Math.floor(min.getHours() / 12) * 12;
                }
                if (scale >= DateScale.Day) {
                    date = min.getDate();
                } else if (scale >= DateScale.HalfMonth) {
                    let threshold = DateHelpers.getHalfMonth(month);
                    date = min.getDate() >= threshold ? threshold : 1;
                }
                if (scale >= DateScale.Month) {
                    month = min.getMonth();
                }
            }
            min = new Date(year, month, date, hours, minutes, seconds, milliseconds);

            // generate increment function depending on step size.
            let stepFunction: (i: number) => Date;
            switch (scale) {
                case DateScale.Second: stepFunction = (i) => new Date(year, month, date, hours, minutes, seconds + i, 0); break;
                case DateScale.FiveSeconds: stepFunction = (i) => new Date(year, month, date, hours, minutes, seconds + i * 5, 0); break;
                case DateScale.Minute: stepFunction = (i) => new Date(year, month, date, hours, minutes + i, 0, 0); break;
                case DateScale.QuarterHour: stepFunction = (i) => new Date(year, month, date, hours, minutes + i * 15, 0, 0); break;
                case DateScale.Hour: stepFunction = (i) => new Date(year, month, date, hours + i, 0, 0, 0); break;
                case DateScale.HalfDay: stepFunction = (i) => new Date(year, month, date, hours + i * 12, 0, 0, 0); break;
                case DateScale.Day: stepFunction = (i) => new Date(year, month, date + i, 0, 0, 0, 0); break;
                case DateScale.HalfMonth:
                    stepFunction = (i) => {
                        if (date > 1) {
                            i++;
                        }
                        var result = new Date(year, month + Math.floor(i / 2), 1, 0, 0, 0, 0);
                        if (i % 2) {
                            result.setDate(DateHelpers.getHalfMonth(result.getMonth()));
                        }
                        return result;
                    };
                    break;
                case DateScale.Month: stepFunction = (i) => new Date(year, month + i, 1, 0, 0, 0, 0); break;
                default: stepFunction = (i) => new Date(year + i * scale, 0, 1, 0, 0, 0, 0); break;
            }

            // get function to label the bucket, depending on step size.
            let labelFunction = DateHelpers.getLabelFunction(scale);

            // generate the bucket array to return
            let buckets = <DateBucket[]>[];
            let i = 0;
            let loopUpper = min;
            let lastBigChange: number;
            do {
                i++;
                let lowerBound = loopUpper;
                loopUpper = stepFunction(i);
                let bucket = <DateBucket>{
                    lowerBound: lowerBound,
                    upperBound: loopUpper,
                };
                lastBigChange = labelFunction(bucket, lastBigChange);
                buckets.push(bucket);
            } while (loopUpper <= max);

            return buckets;
        }

        // generate function to label the bucket, depending on step size.
        static getLabelFunction(scale: DateScale): (bucket: DateBucket, lastBigChange: number) => number {
            switch (scale) {
                case DateScale.Second:
                case DateScale.FiveSeconds:
                case DateScale.Minute:
                case DateScale.QuarterHour:
                case DateScale.Hour:
                case DateScale.HalfDay:
                    // this function uses left and right labels for the range of each bucket.
                    // it only displays the time for most of them, unless it's a new day.
                    return (bucket: DateBucket, lastBigChange: number) => {
                        let newDate = bucket.lowerBound.getDate();
                        let leftLabel: string;
                        if (lastBigChange === newDate) {
                            leftLabel = bucket.lowerBound.toLocaleTimeString();
                        } else {
                            leftLabel = bucket.lowerBound.toLocaleDateString() + " " + bucket.lowerBound.toLocaleTimeString();
                            lastBigChange = newDate;
                        }
                        let rightLabel: string;
                        if (lastBigChange === bucket.upperBound.getDate()) {
                            rightLabel = bucket.upperBound.toLocaleTimeString();
                        } else {
                            rightLabel = bucket.upperBound.toLocaleDateString() + " " + bucket.upperBound.toLocaleTimeString();
                        }
                        DateHelpers.setLabels(bucket, leftLabel, rightLabel);
                        return lastBigChange;
                    };
                case DateScale.Day:
                    // this function displays the date, as a centered label
                    return (bucket: DateFacetFilter, lastBigChange: number) => {
                        DateHelpers.setLabels(bucket, bucket.lowerBound.toLocaleDateString());
                        return lastBigChange;
                    };
                case DateScale.HalfMonth:
                    // this function displays left and right labels with the current date.
                    return (bucket: DateFacetFilter, lastBigChange: number) => {
                        DateHelpers.setLabels(bucket, bucket.lowerBound.toLocaleDateString(), bucket.upperBound.toLocaleDateString());
                        return lastBigChange;
                    };
                case DateScale.Month:
                    // this function displays only the month and possibly the year, centered.
                    // it isn't properly localized.
                    return (bucket: DateFacetFilter, lastBigChange: number) => {
                        var newYear = bucket.lowerBound.getFullYear();
                        var label = DateHelpers.months[bucket.lowerBound.getMonth()];
                        if (lastBigChange !== newYear) {
                            // display the year
                            lastBigChange = newYear;
                            label += " " + newYear;
                        }
                        DateHelpers.setLabels(bucket, label);
                        return lastBigChange;
                    };
                default:
                    // these functione display the years.
                    if (scale == 1) {
                        // this function displays just the year.
                        return (bucket: DateFacetFilter, lastBigChange: number) => {
                            DateHelpers.setLabels(bucket, bucket.lowerBound.getFullYear().toString());
                            return lastBigChange;
                        };
                    } else {
                        // this function displays the decade, century, etc., with an "s" on the end.
                        return (bucket: DateFacetFilter, lastBigChange: number) => {
                            DateHelpers.setLabels(bucket, Math.floor(bucket.lowerBound.getFullYear() / scale) * scale + "s");
                            return lastBigChange;
                        };
                    }
            }
        }

        static setLabels(bucket: DateBucket, leftOrMiddle: string, right?: string) {
            if (right) {
                bucket.label = leftOrMiddle + " to " + right;
                bucket.leftLabel = leftOrMiddle;
                bucket.rightLabel = right;
            } else {
                bucket.label = leftOrMiddle;
            }
        }
    }

}
