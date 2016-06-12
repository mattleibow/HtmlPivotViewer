///<reference path="../typings/index.d.ts" />
///<reference path="../typings/draggabilly.d.ts" />

namespace Pivot {

    // A very simple Javascript range slider control.
    export class PivotSlider {
        private dragTracker: DraggabillyStatic;
        private pixelUnits: number; // how wide each pixel is on the number line
        private pxPosition: number; // the position of the slider handle, in pixels from the left end

        private value: number; // the position the mouse was pressed down on the slider bar
        private stepSize: number; // how far to move for each click on plus or minus
        private min: number;
        private max: number;

        private leftLabel: string;
        private rightLabel: string
        private container: JQuery;
        private minusButton: JQuery; // the HTML element for the minus button at the left
        private plusButton: JQuery; // the HTML element for the plus button at the right
        private sliderHandle: JQuery; // the HTML element that can be grabbed and moved
        private sliderBackground: JQuery; // the HTML element for the horizontal background line

        constructor(containerElement: HTMLElement | JQuery, initialMin: number, initialMax: number, initialValue: number, leftLabelText: string, rightLabelText: string) {
            this.container = $(containerElement);
            this.leftLabel = leftLabelText;
            this.rightLabel = rightLabelText;

            // sanitize the arguments
            if (!(initialMin < initialMax)) {
                initialMin = 0;
                initialMax = 1;
            }
            this.min = initialMin;
            this.max = initialMax;
            if (typeof initialValue !== "number") {
                this.value = this.min + (this.max - this.min) / 2;
            } else {
                this.value = initialValue;
            }
            this.stepSize = (this.max - this.min) / 16;

            this.minusButton = $("<div>").html("&minus;").attr("title", this.leftLabel).addClass("pivot_zoomout pivot_hoverable").appendTo(this.container);
            this.plusButton = $("<div>").text("+").attr("title", this.rightLabel).addClass("pivot_zoomin pivot_hoverable").appendTo(this.container);
            this.sliderBackground = $("<div>").addClass("pivot_zoomline").appendTo(this.container);
            this.sliderHandle = $("<div>").addClass("pivot_zoomhandle").appendTo(this.sliderBackground);
            this.pixelUnits = (this.max - this.min) / (this.sliderBackground.outerWidth() - this.sliderHandle.outerWidth());

            // handle a click on the minus button
            this.minusButton.click(() => {
                if (!this.minusButton.hasClass("pivot_disabled")) {
                    this.setValue(this.value - this.stepSize, true);
                }
            });

            // handle a click on the plus button
            this.plusButton.click(() => {
                if (!this.plusButton.hasClass("pivot_disabled")) {
                    this.setValue(this.value + this.stepSize, true);
                }
            });

            this.dragTracker = new Draggabilly(this.sliderHandle[0], {
                axis: "x",
                containment: this.sliderBackground[0]
            });
            this.dragTracker.on("dragMove", () => {
                this.setValue(this.dragTracker.position.x * this.pixelUnits + this.min, true);
            });

            // handle a click elsewhere inside the slider
            this.container.click((e: JQueryEventObject) => {
                var target = e.target;
                // ignore clicks that were on the buttons or slider handle
                if (target === this.container[0] || target === this.sliderBackground[0]) {
                    // get the mouse position relative to the slider bar
                    var position = e.offsetX;
                    if (target === this.container[0]) {
                        position -= this.sliderBackground.position().left;
                    }
                    if (position >= 0 && position < this.sliderBackground.outerWidth()) {
                        // move the slider to the value that was clicked
                        this.setValue((position - this.sliderHandle.outerWidth() / 2) * this.pixelUnits + this.min, true);
                    }
                }
            });

            this.setValue(initialValue);
        }

        // this function checks that the value is in the allowed range, and
        // disables or enables the plus and minus buttons as necessary. It also
        // sets the position of the slider bar. It won't do anything if called
        // while the user is actively interacting with the control, unless the
        // internal parameter is true. Also, if the internal parameter is true,
        // this function raises the change event.
        setValue(newValue: number, internal?: boolean) {
            // set the new value
            var oldValue = this.value;
            this.value = newValue;

            // check whether buttons should be enabled or disabled
            if (this.value <= this.min) {
                this.value = this.min;
                if (!this.minusButton.hasClass("pivot_disabled")) {
                    this.minusButton.attr("title", "");
                    this.minusButton.addClass("pivot_disabled");
                }
            } else if (this.minusButton.hasClass("pivot_disabled")) {
                this.minusButton.attr("title", this.leftLabel);
                this.minusButton.removeClass("pivot_disabled");
            }
            if (this.value >= this.max) {
                this.value = this.max;
                if (!this.plusButton.hasClass("pivot_disabled")) {
                    this.plusButton.attr("title", "");
                    this.plusButton.addClass("pivot_disabled")
                }
            } else if (this.plusButton.hasClass("pivot_disabled")) {
                this.plusButton.attr("title", this.rightLabel);
                this.plusButton.removeClass("pivot_disabled");
            }

            if (!this.dragTracker.isDragging) {
                // move the slider handle
                this.pxPosition = Math.round((this.value - this.min) / this.pixelUnits);
                this.sliderHandle.css("left", this.pxPosition + "px");
            }

            // raise a change event
            if (internal && oldValue !== this.value) {
                Helpers.trigger(this, "change", [this.value]);
            }
        }

        addListener(event: string, handler: (eventObject: JQueryEventObject, ...eventData: any[]) => any) {
            Helpers.addListener(this, event, handler);
        }
    }

}
