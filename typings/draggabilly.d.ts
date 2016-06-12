/**
 * Interface for the draggabilly options
 */
interface IDraggabillyOptions {
    /**
     * Specifies on what element the drag interaction starts.
     */
    handle?: any;
    /**
     * Contains movement to the bounds of the element. If true, the container will be the parent element.
     */
    containment?: HTMLElement | string | boolean;
    /**
     * Constrains movement to horizontal or vertical axis: 'x' or 'y'
     */
    axis?: string;
    /**
     * Snaps the element to a grid, every x and y pixels.
     */
    grid?: [number, number];
}

/**
 * Interface for a vector
 */
interface IDraggabillyVector {
    x: number;
    y: number;
}

/**
 * Extend the JQuery interface
 */
interface JQuery {
    // Initialize a draggable object
    draggabilly(options: IDraggabillyOptions): JQuery;

    // Enable, disable or destroy the dragging
    draggabilly(method: string): JQuery;
}

/**
 * Interface for the main object
 */
interface DraggabillyStatic {
    new (element: any, options: IDraggabillyOptions): DraggabillyStatic;

    // The event methods for usage in VanillaJS
    on(eventName: string, handler: (event: any, pointer: any) => void): void;
    off(eventName: string, handler: (event: any, pointer: any) => void): void;
    once(eventName: string, handler: (event: any, pointer: any) => void): void;

    /**
     * Disable the dragging
     */
    disable(): void;

    /**
     * Destroy the draggable object
     */
    destroy(): void;

    /**
     * Enable the dragging
     */
    enable(): void;

    /**
     * The current position in the container
     */
    position: IDraggabillyVector;

    isEnabled: boolean;
    isDragging: boolean;
}

declare var Draggabilly: DraggabillyStatic;

declare module "Draggabilly" {
    export = Draggabilly;
}