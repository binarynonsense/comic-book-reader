(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.EasyBrush = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Brush = void 0;
const bezier_1 = require("./utils/bezier");
const color_1 = require("./utils/color");
const math_1 = require("./utils/math");
// const createCanvas = (function (): (width: number, height: number) => HTMLCanvasElement | OffscreenCanvas {
//     if (typeof OffscreenCanvas === 'undefined') {
//         return (width: number = 0, height: number = 0): HTMLCanvasElement => {
//             const canvas = document.createElement('canvas');
//             canvas.width = width;
//             canvas.height = height;
//             return canvas;
//         }
//     } else {
//         return (width: number = 0, height: number = 0): OffscreenCanvas => {
//             const canvas = new OffscreenCanvas(width, height);
//             return canvas;
//         }
//     }
// })()
// const getContext = (function (): Function {
//     if (typeof OffscreenCanvas === 'undefined') {
//         return (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
//             return canvas.getContext('2d') as CanvasRenderingContext2D;
//         }
//     } else {
//         return (canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D => {
//             return canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
//         }
//     }
// })
const createCanvas = (width = 0, height = 0) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};
const getContext = (canvas) => {
    return canvas.getContext('2d', { willReadFrequently: true });
};
const defaultBasicConfig = {
    size: 20,
    opacity: 1.00,
    flow: 1.00,
    color: "#000000",
    angle: 0.00,
    roundness: 1.00,
    spacing: 0.5,
};
/**
 * Basic brush object
 *
 * @param canvas Canvas Element (If not, please use loadContext to load it later)
 * @param config Brush Config (If not, please access the config property later or use the loadConfig function to modify it)
 */
class Brush {
    initCanvasStack() {
        this.canvasStack = [];
        this.canvasStackIndex = -1;
        if (this.maxUndoRedoStackSize <= 0) {
            return;
        }
        if (this.oriCanvas && this.oriContext) {
            this.canvasStack.push(this.oriContext.getImageData(0, 0, this.oriCanvas.width, this.oriCanvas.height));
            this.canvasStackIndex++;
        }
    }
    /**
     * Undo
     */
    undo() {
        var _a, _b;
        if (this.canvasStackIndex > 0) {
            this.canvasStackIndex--;
            (_a = this.context) === null || _a === void 0 ? void 0 : _a.putImageData(this.canvasStack[this.canvasStackIndex], 0, 0);
            (_b = this.oriContext) === null || _b === void 0 ? void 0 : _b.putImageData(this.canvasStack[this.canvasStackIndex], 0, 0);
        }
    }
    /**
     * Redo
     */
    redo() {
        var _a, _b;
        if (this.canvasStackIndex < this.canvasStack.length - 1) {
            this.canvasStackIndex++;
            (_a = this.context) === null || _a === void 0 ? void 0 : _a.putImageData(this.canvasStack[this.canvasStackIndex], 0, 0);
            (_b = this.oriContext) === null || _b === void 0 ? void 0 : _b.putImageData(this.canvasStack[this.canvasStackIndex], 0, 0);
        }
    }
    initSourceCanvas(canvas) {
        this.canvas = canvas;
        this.context = getContext(this.canvas);
    }
    initOriCanvas(canvas) {
        this.oriCanvas = createCanvas(canvas.width, canvas.height);
        this.oriContext = getContext(this.oriCanvas);
        this.oriContext.drawImage(canvas, 0, 0, canvas.width, canvas.height);
    }
    initStrokeCanvas(canvas) {
        this.strokeCanvas = createCanvas(canvas.width, canvas.height);
        this.strokeContext = getContext(this.strokeCanvas);
    }
    initTransferCanvasCanvas(canvas) {
        this.transferCanvas = createCanvas(canvas.width, canvas.height);
        this.transferContext = getContext(this.transferCanvas);
    }
    /**
     * Load the canvas you want to draw
     * @param canvas
     */
    loadContext(canvas) {
        this.initSourceCanvas(canvas);
        this.initOriCanvas(canvas);
        this.initStrokeCanvas(canvas);
        this.initTransferCanvasCanvas(canvas);
        this.initCanvasStack();
    }
    get shapeRatio() {
        if (this.shapeCanvas) {
            return this.shapeCanvas.width / this.shapeCanvas.height;
        }
        else {
            return 1;
        }
    }
    constructor(canvas, config) {
        /***********************************Undo/Redo**********************************/
        this.canvasStack = [];
        this.canvasStackIndex = -1;
        /**
         * Maximum number of undo/redo operations (0 means no limit)
         */
        this.maxUndoRedoStackSize = 10;
        /******************************************************************************/
        this.points = [];
        this.drawCount = 0;
        this.isRender = false;
        this.modules = new Map();
        /** min space pixel */
        this.minSpacePixel = 0.5;
        /** min render interval */
        this.minRenderInterval = 3000;
        /** lag distance */
        this.lagDistance = 5;
        /** Brush Config */
        this.config = defaultBasicConfig;
        /** Is curve smoothing enabled (default: true) */
        this.isSmooth = true;
        /** Is interpolation filling enabled (default: true) */
        this.isSpacing = true;
        /** Blend Mode (default: 'source-over') */
        this.blendMode = 'source-over';
        /** Filter (default: 'none') */
        this.filter = 'none';
        if (config)
            this.loadConfig(config);
        if (canvas)
            this.loadContext(canvas);
    }
    newPoint(x, y, pressure) {
        const cnf = Object.assign({}, this.config);
        for (let [_, module] of this.modules) {
            if (module.onChangeConfig) {
                module.onChangeConfig(cnf, pressure);
            }
        }
        if (cnf.opacity > 1)
            cnf.opacity = 1;
        else if (cnf.opacity < 0)
            cnf.opacity = 0;
        if (cnf.flow > 1)
            cnf.flow = 1;
        else if (cnf.flow < 0)
            cnf.flow = 0;
        if (cnf.angle > 1)
            cnf.angle = 1;
        else if (cnf.angle < 0)
            cnf.angle = 0;
        if (cnf.roundness > 1)
            cnf.roundness = 1;
        else if (cnf.roundness < 0)
            cnf.roundness = 0;
        return { x, y, pressure, config: cnf };
    }
    mixin() {
        if (!this.canvas || !this.context || !this.oriCanvas || !this.oriContext || !this.strokeCanvas || !this.strokeContext || !this.transferCanvas || !this.transferContext) {
            throw new Error('Canvas not loaded, please use "loadContext" to load it');
        }
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.oriCanvas, 0, 0);
        //@ts-ignore
        let strokeCanvas = this.strokeCanvas;
        //@ts-ignore
        let strokeContext = this.strokeContext;
        // onMergeCanvas
        for (let [_, module] of this.modules) {
            if (module.onMixinCanvas) {
                [strokeCanvas, strokeContext] = module.onMixinCanvas(this.strokeCanvas, this.strokeContext);
            }
        }
        // transfer canvas
        this.transferContext.clearRect(0, 0, this.transferCanvas.width, this.transferCanvas.height);
        this.transferContext.drawImage(strokeCanvas, 0, 0);
        // blend mode
        const globalCompositeOperation = this.context.globalCompositeOperation;
        this.context.globalCompositeOperation = this.blendMode;
        // filter
        const filter = this.context.filter;
        this.context.filter = this.filter;
        this.context.drawImage(this.transferCanvas, 0, 0);
        // blend mode restore
        this.context.globalCompositeOperation = globalCompositeOperation;
        // filter restore
        this.context.filter = filter;
    }
    endStroke() {
        if (!this.canvas || !this.context || !this.oriCanvas || !this.oriContext || !this.strokeCanvas || !this.strokeContext || !this.transferCanvas || !this.transferContext) {
            throw new Error('Canvas not loaded, please use "loadContext" to load it');
        }
        //@ts-ignore
        let strokeCanvas = this.strokeCanvas;
        //@ts-ignore
        let strokeContext = this.strokeContext;
        // onMergeCanvas
        for (let [_, module] of this.modules) {
            if (module.onMixinCanvas) {
                [strokeCanvas, strokeContext] = module.onMixinCanvas(this.strokeCanvas, this.strokeContext);
            }
        }
        // transfer canvas
        this.transferContext.clearRect(0, 0, this.transferCanvas.width, this.transferCanvas.height);
        this.transferContext.drawImage(strokeCanvas, 0, 0);
        this.oriContext.drawImage(this.transferCanvas, 0, 0);
        this.strokeContext.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        // command stack
        if (this.maxUndoRedoStackSize > 0) {
            if (this.canvasStackIndex != this.canvasStack.length - 1) {
                this.canvasStack.splice(this.canvasStackIndex + 1, this.canvasStack.length - this.canvasStackIndex - 1);
            }
            this.canvasStackIndex = this.canvasStack.push((this.context.getImageData(0, 0, this.canvas.width, this.canvas.height))) - 1;
            if (this.canvasStack.length > this.maxUndoRedoStackSize) {
                this.canvasStack.shift();
                this.canvasStackIndex--;
            }
        }
        // onEndStroke
        for (let [_, module] of this.modules) {
            if (module.onEndStroke) {
                module.onEndStroke();
            }
        }
    }
    // draw point
    draw() {
        if (!this.oriCanvas || !this.oriContext || !this.strokeCanvas || !this.strokeContext || !this.transferCanvas || !this.transferContext) {
            throw new Error('Canvas not loaded, please use "loadContext" to load it');
        }
        if (this.points.length === 0) {
            return;
        }
        const p = this.points.shift();
        this.strokeContext.save();
        // flow
        this.strokeContext.globalAlpha = p.config.flow;
        // opacity
        this.transferContext.globalAlpha = p.config.opacity;
        // draw to stroke canvas
        if (this.shapeCanvas && this.shapeContext) {
            // change color
            if (this.shapeContext.fillStyle !== p.config.color.toLowerCase()) {
                console.log(1);
                const globalCompositeOperation = this.shapeContext.globalCompositeOperation;
                this.shapeContext.globalCompositeOperation = "source-atop";
                this.shapeContext.fillStyle = (0, color_1.toHashColor)(p.config.color);
                this.shapeContext.beginPath();
                this.shapeContext.fillRect(0, 0, this.shapeCanvas.width, this.shapeCanvas.height);
                this.shapeContext.globalCompositeOperation = globalCompositeOperation;
            }
            //rotate
            this.strokeContext.translate(p.x, p.y);
            this.strokeContext.rotate(-p.config.angle * 360 * Math.PI / 180);
            this.strokeContext.translate(-(p.config.size * p.config.roundness / 2), -(p.config.size / this.shapeRatio / 2));
            const width = p.config.size * p.config.roundness;
            const height = p.config.size / this.shapeRatio;
            this.strokeContext.drawImage(this.shapeCanvas, 0, 0, width, height);
            // rotate back
            // this.strokeContext.translate(-p.x, -p.y)
            // this.strokeContext.rotate(p.config.angle * 360 * Math.PI / 180)
            // this.strokeContext.translate(p.config.size * p.config.roundness / 2, p.config.size / this.shapeRatio / 2)
        }
        else {
            const size = p.config.size;
            const roundness = p.config.roundness;
            const smallerRadius = size * roundness;
            this.strokeContext.beginPath();
            this.strokeContext.fillStyle = p.config.color;
            this.strokeContext.translate(p.x, p.y);
            this.strokeContext.rotate(-p.config.angle * 360 * Math.PI / 180);
            this.strokeContext.ellipse(0, 0, size, smallerRadius, 0, 0, Math.PI * 2, false);
            this.strokeContext.fill();
            // rotate back
            // this.strokeContext.translate(-p.x, -p.y)
            // this.strokeContext.rotate(p.config.angle * 360 * Math.PI / 180)
            this.strokeContext.closePath();
        }
        this.strokeContext.restore();
        // mixin to show canvas
        if (this.points.length === 0 || this.drawCount >= this.minRenderInterval) {
            this.mixin();
            this.drawCount = 0;
        }
        else {
            this.drawCount++;
        }
        // strokeEnd
        if (p.strokeEnd === true) {
            this.endStroke();
        }
        // callback
        if (p.callback)
            try {
                p.callback();
            }
            catch (err) {
                console.error(err);
            }
    }
    imageInitColoring() {
        if (!this.shapeCanvas || !this.shapeContext)
            return;
        const oriGlobalCompositeOperation = this.shapeContext.globalCompositeOperation;
        this.shapeContext.globalCompositeOperation = "source-atop";
        this.shapeContext.fillStyle = "#000000";
        this.shapeContext.beginPath();
        this.shapeContext.rect(0, 0, this.shapeCanvas.width, this.shapeCanvas.height);
        this.shapeContext.fill();
        this.shapeContext.closePath();
        this.shapeContext.globalCompositeOperation = oriGlobalCompositeOperation;
    }
    loadImageWithCanvas(img) {
        const canvas = img;
        if (canvas.width === 0 || canvas.height === 0) {
            console.warn("[loadImage] Canvas size is 0, please check your canvas.");
            return;
        }
        this.shapeCanvas = canvas;
        this.shapeContext = canvas.getContext("2d");
        this.imageInitColoring();
    }
    loadImageWithElement(img) {
        const image = img;
        const shapeCvs = document.createElement("canvas");
        if (image.naturalWidth === 0 || image.naturalHeight === 0) {
            console.warn("[loadImage] Image natural size is 0, please check your image url.");
            return;
        }
        shapeCvs.width = image.naturalWidth;
        shapeCvs.height = image.naturalHeight;
        const shapeCtx = shapeCvs.getContext("2d");
        shapeCtx.globalAlpha = 1;
        shapeCtx.drawImage(image, 0, 0, shapeCvs.width, shapeCvs.height);
        this.shapeCanvas = shapeCvs;
        this.shapeContext = shapeCtx;
        this.imageInitColoring();
    }
    loadImageWithUrl(url, callback, onError) {
        const image = new Image();
        image.src = url;
        image.onload = () => {
            this.loadImageWithElement(image);
            callback === null || callback === void 0 ? void 0 : callback();
        };
        image.onerror = () => {
            onError === null || onError === void 0 ? void 0 : onError();
        };
    }
    /**
     * Load/Modify Brush Configuration
     *
     * This function only exists in the config field.
     *
     * You can also modify brush.config
     *
     * @example
     * brush.loadConfig({size: 10})
     * brush.config.size = 10
     */
    loadConfig(config) {
        if (config.size != void 0 && config.size != null)
            this.config.size = config.size;
        if (config.opacity != void 0 && config.opacity != null)
            this.config.opacity = config.opacity;
        if (config.flow != void 0 && config.flow != null)
            this.config.flow = config.flow;
        if (config.color != void 0 && config.color != null)
            this.config.color = config.color;
        if (config.angle != void 0 && config.angle != null)
            this.config.angle = config.angle;
        if (config.roundness != void 0 && config.roundness != null)
            this.config.roundness = config.roundness;
        if (config.spacing != void 0 && config.spacing != null)
            this.config.spacing = config.spacing;
    }
    /**
     * Bind config to brush.
     *
     * If you do this, the brush config will change with the external config
     */
    bindConfig(config) {
        this.config = config;
    }
    /**
     * This function allows loading images as brush styles.
     *
     * The image format has strict requirements.
     * Please use '.png' images with a transparent background or other image formats
     * with a transparent background. Pixels with content in the image will be used as the pattern shape.
     *
     * Tip: It takes some time to load images based on URL (string) ! ! !
     * Pls use 'callback' param or 'loadImageAsync' Function If img as string ! ! !
     */
    loadImage(img, callback) {
        if (img instanceof HTMLCanvasElement) {
            this.loadImageWithCanvas(img);
            callback === null || callback === void 0 ? void 0 : callback(true);
        }
        else if (img instanceof HTMLImageElement) {
            this.loadImageWithElement(img);
            callback === null || callback === void 0 ? void 0 : callback(true);
        }
        else {
            this.loadImageWithUrl(img, () => { callback === null || callback === void 0 ? void 0 : callback(true); }, () => { callback === null || callback === void 0 ? void 0 : callback(false); });
        }
    }
    /**
     * Asynchronous version of 'loadImage'
     */
    loadImageAsync(img) {
        return new Promise((resolve, reject) => {
            this.loadImage(img, (isSuc) => {
                if (isSuc)
                    resolve();
                else
                    reject();
            });
        });
    }
    removeImage() {
        this.shapeCanvas = void 0;
        this.shapeContext = void 0;
    }
    /**
     * Add the current point to the point pool,
     * which will be rendered when the render function is called
     * (interpolation and Bessel calculations will be performed)
     */
    putPoint(x, y, pressure) {
        if (!this.prePoint || !this.isSpacing) {
            this.prePrePoint = this.prePoint;
            this.prePoint = { x, y, pressure };
            // When there is no previous point or spacing is not enabled, simply add it to the coordinate pool without calculating interpolation
            let isHandled = false;
            for (let [_, module] of this.modules) {
                if (module.onChangePoint) {
                    const res = module.onChangePoint({ x, y, pressure }, Object.assign({}, this.config));
                    if (Array.isArray(res)) {
                        for (let p of res) {
                            const point = this.newPoint(p.x, p.y, p.pressure);
                            this.points.push(point);
                        }
                    }
                    else {
                        const point = this.newPoint(res.x, res.y, res.pressure);
                        this.points.push(point);
                    }
                    isHandled = true;
                }
            }
            if (!isHandled) {
                const point = this.newPoint(x, y, pressure);
                this.points.push(point);
            }
        }
        else {
            // Calculate whether interpolation is required between the current point and the previous point, and calculate interpolation and Bezier transform
            const p1 = { x, y, pressure };
            const p2 = this.prePoint;
            const p3 = this.prePrePoint || p2;
            let distance = (0, math_1.getDistance)(p2.x, p2.y, p1.x, p1.y);
            let space = this.config.spacing * this.config.size;
            if (space < this.minSpacePixel)
                space = this.minSpacePixel;
            if (Math.floor(distance / space) <= 0)
                return;
            if (distance < this.lagDistance + space)
                return;
            // 将x，y坐标改为上一个点朝原x，y坐标移动(distance - lagDistance)后的坐标
            const angle = (0, math_1.getAngle)(p2.x, p2.y, p1.x, p1.y);
            p1.x = p2.x + Math.cos(angle) * (distance - this.lagDistance);
            p1.y = p2.y + Math.sin(angle) * (distance - this.lagDistance);
            distance = distance - this.lagDistance;
            // 获取贝塞尔控制点
            const control = (0, bezier_1.getControlPoint)(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
            // 上一个插值点
            const lastP = { x: p1.x, y: p1.y, pressure: p1.pressure };
            if (this.isSmooth) {
                const points = (0, bezier_1.getEquidistantBezierPoints)(p2.x, p2.y, control.x, control.y, p1.x, p1.y, space);
                for (const i in points) {
                    if (!Object.prototype.hasOwnProperty.call(points, i)) {
                        continue;
                    }
                    const point = points[i];
                    const t = parseInt(i) / points.length;
                    const curPressure = p2.pressure + (p1.pressure - p2.pressure) * t;
                    lastP.x = point.x;
                    lastP.y = point.y;
                    lastP.pressure = curPressure;
                    let isHandled = false;
                    for (let [_, module] of this.modules) {
                        if (module.onChangePoint) {
                            const res = module.onChangePoint({ x: point.x, y: point.y, pressure: curPressure }, Object.assign({}, this.config));
                            if (Array.isArray(res)) {
                                for (let p of res) {
                                    this.points.push(this.newPoint(p.x, p.y, p.pressure));
                                }
                            }
                            else {
                                this.points.push(this.newPoint(res.x, res.y, res.pressure));
                            }
                            isHandled = true;
                        }
                    }
                    if (!isHandled) {
                        this.points.push(this.newPoint(point.x, point.y, curPressure));
                    }
                }
            }
            else {
                for (let i = space; i <= distance; i += space) {
                    const t = i / distance;
                    const curPressure = p2.pressure + (p1.pressure - p2.pressure) * t;
                    let pointX, pointY = 0;
                    pointX = p2.x + Math.cos(angle) * i;
                    pointY = p2.y + Math.sin(angle) * i;
                    lastP.x = pointX;
                    lastP.y = pointY;
                    lastP.pressure = curPressure;
                    let isHandled = false;
                    for (let [_, module] of this.modules) {
                        if (module.onChangePoint) {
                            const res = module.onChangePoint({ x: pointX, y: pointY, pressure: curPressure }, Object.assign({}, this.config));
                            if (Array.isArray(res)) {
                                for (let p of res) {
                                    this.points.push(this.newPoint(p.x, p.y, p.pressure));
                                }
                            }
                            else {
                                this.points.push(this.newPoint(res.x, res.y, res.pressure));
                            }
                            isHandled = true;
                        }
                    }
                    if (!isHandled) {
                        this.points.push(this.newPoint(pointX, pointY, curPressure));
                    }
                }
            }
            this.prePrePoint = this.prePoint;
            this.prePoint = { x: lastP.x, y: lastP.y, pressure: lastP.pressure };
        }
    }
    /**
     * Start rendering the coordinate queue data until all the queue data has been rendered,
     * which means that once the render function is run,
     * it will only end when all the coordinate queues have been rendered
     *
     * The render will not run the second one repeatedly.
     * If the rendering is not completed and the render is called repeatedly,
     * it will not produce any effect, so feel free to call it
     */
    render() {
        if (this.isRender)
            return;
        this.isRender = true;
        const loop = () => {
            for (let i = 0; i < this.minRenderInterval; i++) {
                if (this.points.length === 0)
                    break;
                this.draw();
            }
            if (this.points.length > 0) {
                run();
            }
            else {
                this.isRender = false;
            }
        };
        const run = () => {
            try {
                requestAnimationFrame(loop);
            }
            catch (_a) {
                loop();
            }
        };
        run();
    }
    /**
     * Reset brush run data
     *
     * This reset does not clear the queue data that has not been fully rendered yet.
     * It only eliminates the impact of the current pen on the next one.
     * If not cleared, there may be a connection between the end of the previous pen
     * and the beginning of the current pen, as well as other bugs
     */
    finalizeStroke(callback) {
        this.prePoint = void 0;
        this.prePrePoint = void 0;
        if (this.points.length > 0) {
            this.points[this.points.length - 1].strokeEnd = true;
        }
        if (this.points.length > 0) {
            this.points[this.points.length - 1].strokeEnd = true;
        }
        else {
            this.endStroke();
        }
        if (callback) {
            if (this.points.length === 0) {
                try {
                    callback();
                }
                catch (err) {
                    console.error(err);
                }
            }
            else
                this.points[this.points.length - 1].callback = callback;
        }
    }
    /**
     * Clear all canvas
     */
    clear() {
        this.points = [];
        this.prePoint = void 0;
        this.prePrePoint = void 0;
        this.canvas && this.context && this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.oriCanvas && this.oriContext && this.oriContext.clearRect(0, 0, this.oriCanvas.width, this.oriCanvas.height);
        this.strokeCanvas && this.strokeContext && this.strokeContext.clearRect(0, 0, this.strokeCanvas.width, this.strokeCanvas.height);
        this.transferCanvas && this.transferContext && this.transferContext.clearRect(0, 0, this.transferCanvas.width, this.transferCanvas.height);
    }
    /**
     * Use a module
     * @returns module unique id
     */
    useModule(module) {
        for (const [id, existingModule] of this.modules) {
            if (JSON.stringify(existingModule) === JSON.stringify(module)) {
                return id;
            }
        }
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.modules.set(uniqueId, module);
        return uniqueId;
    }
    /**
     * Remove a module
     */
    removeModule(uniqueId) {
        if (this.modules.has(uniqueId)) {
            this.modules.delete(uniqueId);
            return true;
        }
        return false;
    }
}
exports.Brush = Brush;

},{"./utils/bezier":8,"./utils/color":9,"./utils/math":10}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MousePressure = exports.PatternModule = exports.SpreadModule = exports.DynamicTransparencyModule = exports.DynamicShapeModule = exports.Brush = void 0;
var brush_1 = require("./brush");
Object.defineProperty(exports, "Brush", { enumerable: true, get: function () { return brush_1.Brush; } });
var dynamicShape_1 = require("./modules/dynamicShape");
Object.defineProperty(exports, "DynamicShapeModule", { enumerable: true, get: function () { return dynamicShape_1.DynamicShapeModule; } });
var dynamicTransparency_1 = require("./modules/dynamicTransparency");
Object.defineProperty(exports, "DynamicTransparencyModule", { enumerable: true, get: function () { return dynamicTransparency_1.DynamicTransparencyModule; } });
var spread_1 = require("./modules/spread");
Object.defineProperty(exports, "SpreadModule", { enumerable: true, get: function () { return spread_1.SpreadModule; } });
var pattern_1 = require("./modules/pattern");
Object.defineProperty(exports, "PatternModule", { enumerable: true, get: function () { return pattern_1.PatternModule; } });
var pressure_1 = require("./pressure");
Object.defineProperty(exports, "MousePressure", { enumerable: true, get: function () { return pressure_1.MousePressure; } });

},{"./brush":1,"./modules/dynamicShape":3,"./modules/dynamicTransparency":4,"./modules/pattern":5,"./modules/spread":6,"./pressure":7}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicShapeModule = void 0;
const math_1 = require("../utils/math");
const random_1 = require("../utils/random");
const defaultConfig = {
    sizeJitter: 0.00,
    sizeJitterTrigger: "none",
    minDiameter: 0.00,
    angleJitter: 0.00,
    angleJitterTrigger: "none",
    roundJitter: 0.00,
    roundJitterTrigger: "none",
    minRoundness: 0.00,
};
class DynamicShapeModule {
    constructor(config) {
        /** module config */
        this.config = defaultConfig;
        if ((config === null || config === void 0 ? void 0 : config.sizeJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.sizeJitter) != null)
            this.config.sizeJitter = config.sizeJitter;
        if ((config === null || config === void 0 ? void 0 : config.sizeJitterTrigger) != void 0 && (config === null || config === void 0 ? void 0 : config.sizeJitterTrigger) != null)
            this.config.sizeJitterTrigger = config.sizeJitterTrigger;
        if ((config === null || config === void 0 ? void 0 : config.angleJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.angleJitter) != null)
            this.config.angleJitter = config.angleJitter;
        if ((config === null || config === void 0 ? void 0 : config.angleJitterTrigger) != void 0 && (config === null || config === void 0 ? void 0 : config.angleJitterTrigger) != null)
            this.config.angleJitterTrigger = config.angleJitterTrigger;
        if ((config === null || config === void 0 ? void 0 : config.roundJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.roundJitter) != null)
            this.config.roundJitter = config.roundJitter;
        if ((config === null || config === void 0 ? void 0 : config.roundJitterTrigger) != void 0 && (config === null || config === void 0 ? void 0 : config.roundJitterTrigger) != null)
            this.config.roundJitterTrigger = config.roundJitterTrigger;
        if ((config === null || config === void 0 ? void 0 : config.minDiameter) != void 0 && (config === null || config === void 0 ? void 0 : config.minDiameter) != null)
            this.config.minDiameter = config.minDiameter;
        if ((config === null || config === void 0 ? void 0 : config.minRoundness) != void 0 && (config === null || config === void 0 ? void 0 : config.minRoundness) != null)
            this.config.minRoundness = config.minRoundness;
    }
    /**
     * Bind config to brush.
     *
     * If you do this, the brush config will change with the external config
     */
    bindConfig(config) {
        this.config = config;
    }
    changeSize(size, pressure) {
        let newSize = size;
        if (this.config.sizeJitterTrigger === "pressure") {
            newSize = size * (pressure * 2);
        }
        const jitterValue = newSize * this.config.sizeJitter;
        newSize = (0, math_1.clamp)((0, random_1.randomRound)(newSize - jitterValue, newSize), 0, newSize);
        if (newSize < size * this.config.minDiameter) {
            newSize = size * this.config.minDiameter;
        }
        return newSize;
    }
    changeAngle(angle, pressure) {
        let newAngle = angle;
        const cir = Math.PI * 2;
        if (this.config.angleJitterTrigger === "pressure") {
            if (pressure <= 0.5) {
                newAngle = (newAngle + cir * (0.5 - pressure)) % cir;
            }
            else {
                newAngle = (newAngle - cir * (pressure - 0.5)) % cir;
            }
        }
        const jitterValue = cir * this.config.angleJitter;
        newAngle = ((0, random_1.randomRound)(newAngle - jitterValue, newAngle + jitterValue, 100)) % cir;
        return newAngle;
    }
    changeRoundness(roundness, pressure) {
        let newRoundness = roundness;
        if (this.config.roundJitterTrigger === "pressure") {
            newRoundness = roundness * (pressure * 2);
        }
        const jitterValue = newRoundness * this.config.roundJitter;
        newRoundness = (0, math_1.clamp)((0, random_1.randomRound)(newRoundness - jitterValue, newRoundness, 100), 0, newRoundness);
        if (newRoundness < this.config.minRoundness) {
            newRoundness = this.config.minRoundness;
        }
        return newRoundness;
    }
    onChangeConfig(config, pressure) {
        config.size = this.changeSize(config.size, pressure);
        config.angle = this.changeAngle(config.angle, pressure);
        config.roundness = this.changeRoundness(config.roundness, pressure);
    }
}
exports.DynamicShapeModule = DynamicShapeModule;

},{"../utils/math":10,"../utils/random":11}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicTransparencyModule = void 0;
const math_1 = require("../utils/math");
const random_1 = require("../utils/random");
const defaultConfig = {
    opacityJitter: 0.00,
    opacityJitterTrigger: "none",
    minOpacityJitter: 0.00,
    flowJitter: 0.00,
    flowJitterTrigger: "none",
    minFlowJitter: 0.00,
};
class DynamicTransparencyModule {
    constructor(config) {
        /** module config */
        this.config = defaultConfig;
        this.opacity = -1;
        if ((config === null || config === void 0 ? void 0 : config.opacityJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.opacityJitter) != null)
            this.config.opacityJitter = config.opacityJitter;
        if ((config === null || config === void 0 ? void 0 : config.opacityJitterTrigger) != void 0 && (config === null || config === void 0 ? void 0 : config.opacityJitterTrigger) != null)
            this.config.opacityJitterTrigger = config.opacityJitterTrigger;
        if ((config === null || config === void 0 ? void 0 : config.minOpacityJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.minOpacityJitter) != null)
            this.config.minOpacityJitter = config.minOpacityJitter;
        if ((config === null || config === void 0 ? void 0 : config.flowJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.flowJitter) != null)
            this.config.flowJitter = config.flowJitter;
        if ((config === null || config === void 0 ? void 0 : config.flowJitterTrigger) != void 0 && (config === null || config === void 0 ? void 0 : config.flowJitterTrigger) != null)
            this.config.flowJitterTrigger = config.flowJitterTrigger;
        if ((config === null || config === void 0 ? void 0 : config.minFlowJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.minFlowJitter) != null)
            this.config.minFlowJitter = config.minFlowJitter;
    }
    /**
     * Bind config to brush.
     *
     * If you do this, the brush config will change with the external config
     */
    bindConfig(config) {
        this.config = config;
    }
    changeOpacity(opacity, pressure) {
        if (this.opacity != -1)
            return this.opacity;
        let newOpacity = opacity;
        if (this.config.opacityJitterTrigger === "pressure") {
            newOpacity = newOpacity * (pressure * 2);
        }
        const jitterValue = newOpacity * this.config.opacityJitter;
        newOpacity = (0, math_1.clamp)((0, random_1.randomRound)(newOpacity - jitterValue, newOpacity, 100), 0, 1);
        if (newOpacity < this.config.minOpacityJitter * opacity) {
            newOpacity = this.config.minOpacityJitter * opacity;
        }
        this.opacity = newOpacity;
        return newOpacity;
    }
    changeFlow(flow, pressure) {
        let newFlow = flow;
        if (this.config.flowJitterTrigger === "pressure") {
            newFlow = newFlow * (pressure * 2);
        }
        const jitterValue = newFlow * this.config.flowJitter;
        newFlow = (0, math_1.clamp)((0, random_1.randomRound)(newFlow - jitterValue, newFlow, 100), 0, 1);
        if (newFlow < this.config.minFlowJitter * flow) {
            newFlow = this.config.minFlowJitter * flow;
        }
        return newFlow;
    }
    onChangeConfig(config, pressure) {
        config.opacity = this.changeOpacity(config.opacity, pressure);
        config.flow = this.changeFlow(config.flow, pressure);
    }
    onEndStroke() {
        this.opacity = -1;
    }
}
exports.DynamicTransparencyModule = DynamicTransparencyModule;

},{"../utils/math":10,"../utils/random":11}],5:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternModule = void 0;
const defaultConfig = {
    scale: 1.00,
    brightness: 0,
    contrast: 0,
    blendMode: "source-over",
};
/**
 * @param {HTMLCanvasElement} canvas original canvas. Used to obtain width and height
 */
class PatternModule {
    constructor(config) {
        /** module config */
        this.config = defaultConfig;
        this.pattern = void 0;
        this.patternCanvas = document.createElement('canvas');
        this.patternContext = this.patternCanvas.getContext('2d');
        this.patternBlendCanvas = document.createElement('canvas');
        this.patternBlendContext = this.patternBlendCanvas.getContext('2d');
        if ((config === null || config === void 0 ? void 0 : config.scale) != void 0 && (config === null || config === void 0 ? void 0 : config.scale) != null)
            this.config.scale = config.scale;
        if ((config === null || config === void 0 ? void 0 : config.brightness) != void 0 && (config === null || config === void 0 ? void 0 : config.brightness) != null)
            this.config.brightness = config.brightness;
        if ((config === null || config === void 0 ? void 0 : config.contrast) != void 0 && (config === null || config === void 0 ? void 0 : config.contrast) != null)
            this.config.contrast = config.contrast;
        if ((config === null || config === void 0 ? void 0 : config.blendMode) != void 0 && (config === null || config === void 0 ? void 0 : config.blendMode) != null)
            this.config.blendMode = config.blendMode;
    }
    loadImageWithUrl(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = url;
            image.onload = () => {
                resolve(this.loadImageWithElement(image));
            };
            image.onerror = (e) => {
                reject(e);
            };
        });
    }
    loadImageWithElement(img) {
        const image = img;
        const shapeCvs = document.createElement("canvas");
        if (image.naturalWidth === 0 || image.naturalHeight === 0) {
            console.warn("[loadImage] Image natural size is 0, please check your image url.");
        }
        shapeCvs.width = image.naturalWidth;
        shapeCvs.height = image.naturalHeight;
        const shapeCtx = shapeCvs.getContext("2d");
        shapeCtx.globalAlpha = 1;
        shapeCtx.drawImage(image, 0, 0, shapeCvs.width, shapeCvs.height);
        return shapeCvs;
    }
    /**
     * Load pattern image resource
     *
     * If there is no width height, the image will repeat
     * @param resource pattern image resource
     * @param width canvas width
     * @param height canvas height
     */
    loadPattern(resource, canvasWidth, canvasHeight, patternColor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (canvasWidth === 0 || canvasHeight === 0)
                return;
            let image = document.createElement("canvas");
            if (typeof resource == 'string') {
                image = yield this.loadImageWithUrl(resource);
            }
            else if (resource instanceof HTMLImageElement) {
                image = this.loadImageWithElement(resource);
            }
            else if (resource instanceof HTMLCanvasElement) {
                image = resource;
            }
            const cvs = document.createElement("canvas");
            cvs.width = image.width * this.config.scale;
            cvs.height = image.height * this.config.scale;
            const ctx = cvs.getContext("2d");
            let filterFunc = "";
            if (this.config.brightness)
                filterFunc += `brightness(${this.config.brightness}%)`;
            if (this.config.contrast)
                filterFunc += `contrast(${this.config.contrast}%)`;
            if (filterFunc)
                ctx.filter = filterFunc;
            ctx.drawImage(image, 0, 0, cvs.width, cvs.height);
            if (patternColor) {
                ctx.globalCompositeOperation = "multiply";
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = patternColor;
                ctx.fillRect(0, 0, cvs.width, cvs.height);
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = 1.0;
            }
            this.patternCanvas.width = canvasWidth;
            this.patternCanvas.height = canvasHeight;
            this.patternBlendCanvas.width = canvasWidth;
            this.patternBlendCanvas.height = canvasHeight;
            this.patternContext.beginPath();
            this.pattern = this.patternContext.createPattern(cvs, "repeat");
            this.patternContext.fillStyle = this.pattern;
            this.patternContext.fillRect(0, 0, canvasWidth, canvasHeight);
        });
    }
    removePattern() {
        this.pattern = void 0;
    }
    /**
     * Bind config to brush.
     *
     * If you do this, the brush config will change with the external config
     */
    bindConfig(config) {
        this.config = config;
    }
    // @ts-ignore
    onMixinCanvas(strokeCanvas, strokeContext) {
        if (!this.pattern)
            return [strokeCanvas, strokeContext];
        const patternGlobalCompositeOperation = this.patternBlendContext.globalCompositeOperation;
        this.patternBlendContext.clearRect(0, 0, this.patternBlendCanvas.width, this.patternBlendCanvas.height);
        this.patternBlendContext.drawImage(this.patternCanvas, 0, 0);
        this.patternBlendContext.globalCompositeOperation = "destination-in";
        this.patternBlendContext.drawImage(strokeCanvas, 0, 0);
        this.patternBlendContext.globalCompositeOperation = this.config.blendMode;
        this.patternBlendContext.drawImage(strokeCanvas, 0, 0);
        this.patternBlendContext.globalCompositeOperation = patternGlobalCompositeOperation;
        return [this.patternBlendCanvas, this.patternBlendContext];
    }
}
exports.PatternModule = PatternModule;

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpreadModule = void 0;
const math_1 = require("../utils/math");
const random_1 = require("../utils/random");
const defaultConfig = {
    spreadRange: 0.00,
    spreadTrigger: "none",
    count: 1,
    countJitter: 0.00,
    countJitterTrigger: "none",
};
class SpreadModule {
    constructor(config) {
        /** module config */
        this.config = defaultConfig;
        if ((config === null || config === void 0 ? void 0 : config.spreadRange) != void 0 && (config === null || config === void 0 ? void 0 : config.spreadRange) != null)
            this.config.spreadRange = config.spreadRange;
        if ((config === null || config === void 0 ? void 0 : config.spreadTrigger) != void 0 && (config === null || config === void 0 ? void 0 : config.spreadTrigger) != null)
            this.config.spreadTrigger = config.spreadTrigger;
        if ((config === null || config === void 0 ? void 0 : config.count) != void 0 && (config === null || config === void 0 ? void 0 : config.count) != null)
            this.config.count = config.count;
        if ((config === null || config === void 0 ? void 0 : config.countJitter) != void 0 && (config === null || config === void 0 ? void 0 : config.countJitter) != null)
            this.config.countJitter = config.countJitter;
        if ((config === null || config === void 0 ? void 0 : config.countJitterTrigger) != void 0 && (config === null || config === void 0 ? void 0 : config.countJitterTrigger) != null)
            this.config.countJitterTrigger = config.countJitterTrigger;
    }
    /**
     * Bind config to brush.
     *
     * If you do this, the brush config will change with the external config
     */
    bindConfig(config) {
        this.config = config;
    }
    spread(size, x, y, pressure) {
        let count = this.config.count;
        if (this.config.countJitterTrigger === "pressure") {
            count = count - Math.round(count * (1 - pressure * 2));
        }
        const jitterValue = Math.round(count * this.config.countJitter);
        count = (0, math_1.clamp)((0, random_1.randomRound)(count - jitterValue, count), 1, count);
        if (count < 1)
            count = 1;
        const newCoordinates = [];
        for (let i = 0; i < count; i++) {
            const coordinate = { x: 0, y: 0, pressure: pressure };
            if (this.config.spreadTrigger === "pressure") {
                size = size * (pressure * 2);
            }
            coordinate.x = (0, random_1.randomND)(x, size * this.config.spreadRange / 2);
            coordinate.y = (0, random_1.randomND)(y, size * this.config.spreadRange / 2);
            newCoordinates.push(coordinate);
        }
        return newCoordinates;
    }
    onChangePoint(point, config) {
        return this.spread(config.size, point.x, point.y, point.pressure);
    }
}
exports.SpreadModule = SpreadModule;

},{"../utils/math":10,"../utils/random":11}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MousePressure = void 0;
/**
 * Mouse pen pressure simulation
 *
 * When you move the mouse faster, the pen pressure decreases, and vice versa, the pen pressure increases
 *
 * @param {number} k changing index
 */
class MousePressure {
    constructor(k = 3, minRange = 10, maxRange = 100) {
        this.MIDDLE_PRESSURE = 0.5;
        this.MAX_PRESSURE = 0.8;
        this.MIN_PRESSURE = 0.2;
        this.STEP = 0.01;
        this._status = false;
        this.prePoint = void 0;
        this.K = k;
        this.minRange = minRange;
        this.maxRange = maxRange;
        this._status = true;
    }
    /**
     * Get current pen pressure
     * @param x x coordinate
     * @param y y coordinate
     * @returns {number} pressure
     */
    getPressure(x, y) {
        if (!this._status)
            return this.MIDDLE_PRESSURE;
        if (!this.prePoint) {
            this.prePoint = { x, y, pressure: this.MIDDLE_PRESSURE };
            return this.MIDDLE_PRESSURE;
        }
        const distance = Math.sqrt(Math.pow((x - this.prePoint.x), 2) + Math.pow((y - this.prePoint.y), 2));
        let range = this.prePoint.pressure;
        const t = 1 + (10 - 1) * (1 - Math.exp(-this.K * distance));
        if (distance < this.minRange) {
            range += this.STEP * t;
        }
        else if (distance > this.maxRange) {
            range -= this.STEP * t;
        }
        else {
            if (range < this.MIDDLE_PRESSURE) {
                range += this.STEP * t;
            }
            else if (range > this.MIDDLE_PRESSURE) {
                range -= this.STEP * t;
            }
        }
        if (range > this.MAX_PRESSURE)
            range = this.MAX_PRESSURE;
        else if (range < this.MIN_PRESSURE)
            range = this.MIN_PRESSURE;
        this.prePoint = { x, y, pressure: range };
        return range;
    }
    /**
     * Reset pen pressure data
     *
     * Reset the data to its initial state, you need to use it after each transaction ends
     */
    reset() {
        this.prePoint = void 0;
    }
    /**
     * Close pen pressure simulation
     */
    close() {
        this._status = false;
        this.reset();
    }
    /**
     * Open pen pressure simulation
     */
    open() {
        this._status = true;
        this.reset();
    }
    /**
     * Get pen pressure simulation status
     */
    status() {
        return this._status;
    }
}
exports.MousePressure = MousePressure;

},{}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTForLength = exports.getAllControlPoint = exports.getControlPoint = exports.quadraticBezier = exports.getQuadraticBezierDistance = exports.getEquidistantBezierPoints = void 0;
const math_1 = require("./math");
/**
 * 将二阶贝塞尔曲线等距分割。
 * @param {number} p1x 起点x
 * @param {number} p1y 起点y
 * @param {number} ptx 控制点x
 * @param {number} pty 控制点y
 * @param {number} p2x 终点x
 * @param {number} p2y 终点y
 * @param space - 指定的点之间的距离。
 * @returns 分割点的坐标数组。
 */
const getEquidistantBezierPoints = (p1x, p1y, ptx, pty, p2x, p2y, space) => {
    const points = [];
    const totalLength = (0, exports.getQuadraticBezierDistance)(p1x, p1y, ptx, pty, p2x, p2y);
    let accumulatedLength = 0;
    let t = 0;
    let prevPoint = { x: p1x, y: p1y };
    // points.push(prevPoint); // 起始点
    while (accumulatedLength + space <= totalLength) {
        let currentT = t;
        let currentPoint = (0, exports.quadraticBezier)(currentT, p1x, p1y, ptx, pty, p2x, p2y);
        // 调整 t 值找到下一个等距点
        while ((0, math_1.getDistance)(prevPoint.x, prevPoint.y, currentPoint.x, currentPoint.y) < space && currentT <= 1) {
            currentT += 0.001; // 调整步长可以提高精度
            currentPoint = (0, exports.quadraticBezier)(currentT, p1x, p1y, ptx, pty, p2x, p2y);
        }
        if (currentT <= 1) {
            points.push(currentPoint);
            accumulatedLength += space;
            t = currentT;
            prevPoint = currentPoint;
        }
        else {
            break;
        }
    }
    return points;
};
exports.getEquidistantBezierPoints = getEquidistantBezierPoints;
/**
 * 计算二次贝塞尔曲线的近似长度。
 * @param {number} p1x 起点x
 * @param {number} p1y 起点y
 * @param {number} ptx 控制点x
 * @param {number} pty 控制点y
 * @param {number} p2x 终点x
 * @param {number} p2y 终点y
 * @param numSegments - 精度，即曲线被分成多少段来近似计算长度，值越大计算结果越精确，但计算量也越大。
 * @returns 二次贝塞尔曲线的近似长度。
 */
const getQuadraticBezierDistance = (p1x, p1y, ptx, pty, p2x, p2y, numSegments = 100) => {
    let length = 0;
    let prevPoint = { x: p1x, y: p1y };
    for (let i = 1; i <= numSegments; i++) {
        const t = i / numSegments;
        const currentPoint = (0, exports.quadraticBezier)(t, p1x, p1y, ptx, pty, p2x, p2y);
        length += (0, math_1.getDistance)(prevPoint.x, prevPoint.y, currentPoint.x, currentPoint.y);
        prevPoint = currentPoint;
    }
    return length;
};
exports.getQuadraticBezierDistance = getQuadraticBezierDistance;
/**
 * 二次贝塞尔计算
 * @param {number} t 0-1 点位于线段中的位置
 * @param {number} p1x 起点x
 * @param {number} p1y 起点y
 * @param {number} ptx 控制点x
 * @param {number} pty 控制点y
 * @param {number} p2x 终点x
 * @param {number} p2y 终点y
 * @returns
 */
const quadraticBezier = (t, p1x, p1y, ptx, pty, p2x, p2y) => {
    const x = (1 - t) * (1 - t) * p1x + 2 * (1 - t) * t * ptx + t * t * p2x;
    const y = (1 - t) * (1 - t) * p1y + 2 * (1 - t) * t * pty + t * t * p2y;
    return { x, y };
};
exports.quadraticBezier = quadraticBezier;
/**
 * 获取两点之间贝塞尔控制点(一个)
 *
 * @param {number} p1x 终点x
 * @param {number} p1y 终点y
 * @param {number} p2x 起点x
 * @param {number} p2y 起点y
 * @param {number} p3x 起点前一个点x
 * @param {number} p3y 起点前一个点y
 * @param {number} ratio 0-1 默认0.25
 * @returns
 */
const getControlPoint = (p1x, p1y, p2x, p2y, p3x, p3y, ratio = 0.25) => {
    return {
        x: p2x + (p1x - p3x) * ratio,
        y: p2y + (p1y - p3y) * ratio,
    };
};
exports.getControlPoint = getControlPoint;
/**
 * 获取两点之间贝塞尔控制点(共两个)
 *
 * @param {number} p1x 终点x
 * @param {number} p1y 终点y
 * @param {number} p2x 起点x
 * @param {number} p2y 起点y
 * @param {number} p3x 起点前一个点x
 * @param {number} p3y 起点前一个点y
 * @param {number} ratio 0-1 默认0.25
 * @returns
 */
const getAllControlPoint = (p1x, p1y, p2x, p2y, p3x, p3y, ratio = 0.25) => {
    const cA = {
        x: p2x + (p1x - p3x) * ratio,
        y: p2y + (p1y - p3y) * ratio,
    };
    const cB = {
        x: p1x - (p1x - p2x) * ratio,
        y: p1y - (p1y - p2y) * ratio,
    };
    return [cA, cB];
};
exports.getAllControlPoint = getAllControlPoint;
/**
 * 使用二分法找到对应于给定弧长的参数t值。
 * @param {number} p1x 起点x
 * @param {number} p1y 起点y
 * @param {number} ptx 控制点x
 * @param {number} pty 控制点y
 * @param {number} p2x 终点x
 * @param {number} p2y 终点y
 * @param targetLength - 目标弧长。
 * @param tolerance - 容差。
 * @returns 对应于给定弧长的参数t值。
 */
const findTForLength = (p1x, p1y, ptx, pty, p2x, p2y, targetLength, tolerance = 0.001) => {
    let low = 0;
    let high = 1;
    let mid = (low + high) / 2;
    while (high - low > tolerance) {
        mid = (low + high) / 2;
        const length = (0, exports.getQuadraticBezierDistance)(mid, p1x, p1y, ptx, pty, p2x, p2y);
        if (length < targetLength) {
            low = mid;
        }
        else {
            high = mid;
        }
    }
    return mid;
};
exports.findTForLength = findTForLength;

},{"./math":10}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHashColor = void 0;
/**
 * 将输入的字符串颜色转换为标准哈希颜色格式。
 * @param color 输入的颜色字符串，可以是rgb、rgba、三位哈希(#fff)或六位哈希(#ffffff)等格式。
 * @returns 标准的六位哈希颜色字符串，例如：#000000。如果输入格式不合法，则返回默认颜色#000000。
 */
const toHashColor = (color) => {
    const defaultColor = "#000000";
    // 创建一个虚拟的 DOM 元素，用于解析颜色
    const div = document.createElement("div");
    div.style.color = color;
    // 如果颜色无效，浏览器会将其清空
    if (!div.style.color) {
        return defaultColor;
    }
    // 使用 getComputedStyle 获取标准化的颜色值
    document.body.appendChild(div);
    const computedColor = getComputedStyle(div).color;
    document.body.removeChild(div);
    // 解析为 RGB 格式，并转换为哈希颜色
    const rgbRegex = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
    const rgbMatch = computedColor.match(rgbRegex);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, "0")}`;
    }
    // 如果解析失败，返回默认颜色
    return defaultColor;
};
exports.toHashColor = toHashColor;

},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrap = exports.clamp = exports.splitDecimal = exports.getPointBetween = exports.getAngle = exports.getDistance = void 0;
/**
 * Calculate the distance between two points in pixels
 */
const getDistance = (p1x, p1y, p2x, p2y) => {
    return Math.sqrt(Math.pow(p2x - p1x, 2) + Math.pow(p2y - p1y, 2));
};
exports.getDistance = getDistance;
/**
 * Calculate the angle between the line connecting two points and the x-axis
 */
const getAngle = (p1x, p1y, p2x, p2y) => {
    return Math.atan2(p2y - p1y, p2x - p1x);
};
exports.getAngle = getAngle;
/**
 * Obtain the coordinates of a certain point on a line composed of two points
 *
 * Swapping positions from point 1 to point 2 will result in different results.
 * The concept of t is to draw a straight line from point 1 to point 2 and go to the coordinates at the length of t
 */
const getPointBetween = (p1x, p1y, p2x, p2y, t) => {
    if (t === void 0) {
        return {
            x: (p1x + p2x) / 2,
            y: (p1y + p2y) / 2
        };
    }
    else {
        return {
            x: p1x + (p2x - p1x) * t,
            y: p1y + (p2y - p1y) * t
        };
    }
};
exports.getPointBetween = getPointBetween;
/**
 * Splitting decimals into 'unit'. unit defaults to 1
 *
 * @example
 * splitDecimal(3.2) // [1, 1, 1, 0.2]
 * splitDecimal(4.1, 2) // [2, 2, 0.1]
 * splitDecimal(4, 3) // [3, 1]
 */
const splitDecimal = (num, unit = 1) => {
    const result = [];
    const wholePart = Math.floor(num / unit);
    const decimalPart = num - wholePart * unit;
    for (let i = 0; i < wholePart; i++) {
        result.push(unit);
    }
    if (decimalPart > 0) {
        result.push(decimalPart);
    }
    return result;
};
exports.splitDecimal = splitDecimal;
/**
 * Digital convergence
 *
 * Shrink num between min max, if it exceeds or falls below, the maximum/minimum value will be taken
 *
 * @example
 * clamp(5, 1, 3) // 3
 * clamp(2, 1, 3) // 2
 */
const clamp = (num, min, max) => {
    return Math.min(Math.max(num, min), max);
};
exports.clamp = clamp;
/**
 * Digital convergence
 *
 * Shrink num between 0 and max, take the remainder if it exceeds 0,
 * and take the difference between its absolute value and max if it is less than 0
 *
 * @example
 * wrap(5, 3) // 2
 * wrap(-5, 3) // 2
 * wrap(2, 3) // 2
 */
const wrap = (num, max) => {
    if (num < 0) {
        return num - Math.floor(num / max) * max;
    }
    else if (num > max) {
        return num - Math.floor(num / max) * max;
    }
    else {
        return num;
    }
};
exports.wrap = wrap;

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomND = exports.randomRound = void 0;
const randomRound = (min, max, accuracy = 1) => {
    return Math.floor(Math.random() * (max * accuracy - min * accuracy + 1) + min * accuracy) / accuracy;
};
exports.randomRound = randomRound;
/**
 * Normal Distribution Random
 */
const randomND = (mean, stdDev) => {
    let u, v, w;
    do {
        u = Math.random() * 2 - 1.0;
        v = Math.random() * 2 - 1.0;
        w = u * u + v * v;
    } while (w == 0.0 || w >= 1.0);
    const c = Math.sqrt((-2 * Math.log(w)) / w);
    return mean + (u * c) * stdDev;
};
exports.randomND = randomND;

},{}]},{},[2])(2)
});
