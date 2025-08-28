import React, { useEffect, useRef } from 'react';
import '../../styles/folding-loader.css';

// 类型定义
interface Dot {
    el: HTMLDivElement | null;
    x: number;
    y: number;
    ox: number;
    oy: number;
}

interface DotsRef {
    d1: Dot;
    d2: Dot;
    d3: Dot;
    d4: Dot;
}

interface LineElements {
    top: SVGLineElement | null;
    right: SVGLineElement | null;
    bottom: SVGLineElement | null;
    left: SVGLineElement | null;
    diag1: SVGLineElement | null;
    diag2: SVGLineElement | null;
}

interface FoldingLoaderProps {
    size?: number;
}

const FoldingLoader: React.FC<FoldingLoaderProps> = ({ size = 100 }) => {
    // Refs for DOM elements
    const loaderRef = useRef<HTMLDivElement>(null);
    const centerSquareRef = useRef<HTMLDivElement>(null);
    const d1Ref = useRef<HTMLDivElement>(null);
    const d2Ref = useRef<HTMLDivElement>(null);
    const d3Ref = useRef<HTMLDivElement>(null);
    const d4Ref = useRef<HTMLDivElement>(null);
    const linesRef = useRef<LineElements>({
        top: null, right: null, bottom: null, left: null,
        diag1: null, diag2: null
    });

    // Refs to store animation state and variables, avoiding re-renders
    const dotsRef = useRef<DotsRef | null>(null);
    const isAnimating = useRef(false);
    const isFolded = useRef(true);
    const animationTimeoutId = useRef<NodeJS.Timeout | null>(null);
    const isMounted = useRef(false);

    // Dynamic calculations based on the size prop
    const scale = size / 100;
    const dotSize = 12 * scale;
    const centerSquareSize = 40 * scale;
    const maxCoordinate = size - dotSize;
    const centerOffset = dotSize / 2;

    useEffect(() => {
        isMounted.current = true;
        
        // Map DOM element refs
        const dotElements = {
            d1: d1Ref.current,
            d2: d2Ref.current,
            d3: d3Ref.current,
            d4: d4Ref.current,
        };
        const lineElements = {
            top: linesRef.current.top,
            right: linesRef.current.right,
            bottom: linesRef.current.bottom,
            left: linesRef.current.left,
            diag1: linesRef.current.diag1,
            diag2: linesRef.current.diag2,
        };
        
        // Initialize dot positions and original coordinates
        dotsRef.current = {
            d1: { el: dotElements.d1, x: 0, y: maxCoordinate, ox: 0, oy: maxCoordinate },
            d2: { el: dotElements.d2, x: 0, y: 0, ox: 0, oy: 0 },
            d3: { el: dotElements.d3, x: maxCoordinate, y: 0, ox: maxCoordinate, oy: 0 },
            d4: { el: dotElements.d4, x: maxCoordinate, y: maxCoordinate, ox: maxCoordinate, oy: maxCoordinate }
        };

        const animationDuration = 400;
        const delayBetweenAnimations = 100;

        function easeInOutCubic(t: number): number {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function updatePositions(): void {
            const dots = dotsRef.current;
            if (!dots) return;
            
            for (const key in dots) {
                const dot = dots[key as keyof DotsRef];
                if (dot.el) {
                    dot.el.style.transform = `translate(${dot.x}px, ${dot.y}px)`;
                }
            }
            const d1c = { x: dots.d1.x + centerOffset, y: dots.d1.y + centerOffset };
            const d2c = { x: dots.d2.x + centerOffset, y: dots.d2.y + centerOffset };
            const d3c = { x: dots.d3.x + centerOffset, y: dots.d3.y + centerOffset };
            const d4c = { x: dots.d4.x + centerOffset, y: dots.d4.y + centerOffset };

            // Update SVG line coordinates
            if (lineElements.top) {
                lineElements.top.setAttribute('x1', d2c.x.toString());
                lineElements.top.setAttribute('y1', d2c.y.toString());
                lineElements.top.setAttribute('x2', d3c.x.toString());
                lineElements.top.setAttribute('y2', d3c.y.toString());
            }
            if (lineElements.right) {
                lineElements.right.setAttribute('x1', d3c.x.toString());
                lineElements.right.setAttribute('y1', d3c.y.toString());
                lineElements.right.setAttribute('x2', d4c.x.toString());
                lineElements.right.setAttribute('y2', d4c.y.toString());
            }
            if (lineElements.bottom) {
                lineElements.bottom.setAttribute('x1', d4c.x.toString());
                lineElements.bottom.setAttribute('y1', d4c.y.toString());
                lineElements.bottom.setAttribute('x2', d1c.x.toString());
                lineElements.bottom.setAttribute('y2', d1c.y.toString());
            }
            if (lineElements.left) {
                lineElements.left.setAttribute('x1', d1c.x.toString());
                lineElements.left.setAttribute('y1', d1c.y.toString());
                lineElements.left.setAttribute('x2', d2c.x.toString());
                lineElements.left.setAttribute('y2', d2c.y.toString());
            }
            if (lineElements.diag1) {
                lineElements.diag1.setAttribute('x1', d2c.x.toString());
                lineElements.diag1.setAttribute('y1', d2c.y.toString());
                lineElements.diag1.setAttribute('x2', d4c.x.toString());
                lineElements.diag1.setAttribute('y2', d4c.y.toString());
            }
            if (lineElements.diag2) {
                lineElements.diag2.setAttribute('x1', d3c.x.toString());
                lineElements.diag2.setAttribute('y1', d3c.y.toString());
                lineElements.diag2.setAttribute('x2', d1c.x.toString());
                lineElements.diag2.setAttribute('y2', d1c.y.toString());
            }
        }

        function animateDot(dot: Dot, toPos: { x: number; y: number }, duration: number): Promise<void> {
            return new Promise<void>(resolve => {
                const startX = dot.x, startY = dot.y;
                const endX = toPos.x, endY = toPos.y;
                let startTime: number | null = null;
                function step(timestamp: number) {
                    if (!startTime) startTime = timestamp;
                    const progress = Math.min((timestamp - startTime) / duration, 1);
                    const easedProgress = easeInOutCubic(progress);
                    dot.x = startX + (endX - startX) * easedProgress;
                    dot.y = startY + (endY - startY) * easedProgress;
                    updatePositions();
                    if (progress < 1) {
                        requestAnimationFrame(step);
                    } else {
                        dot.x = endX; dot.y = endY;
                        updatePositions();
                        resolve();
                    }
                }
                requestAnimationFrame(step);
            });
        }

        async function flash(element: HTMLElement): Promise<void> {
            element.classList.add('flashing-mode');
            await new Promise(resolve => setTimeout(resolve, 50));
            for (let i = 0; i < 2; i++) {
                element.style.opacity = '0.4';
                await new Promise(resolve => setTimeout(resolve, 50));
                element.style.opacity = '1';
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            element.style.opacity = '0.4';
            await new Promise(resolve => setTimeout(resolve, 100));
            element.style.opacity = '1';
            await new Promise(resolve => setTimeout(resolve, 100));
            element.classList.remove('flashing-mode');
        }

        async function fold(): Promise<void> {
            const dots = dotsRef.current;
            if (!dots) return;
            
            if (loaderRef.current) {
                loaderRef.current.classList.add('collapsed');
            }
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (lineElements.bottom) lineElements.bottom.style.opacity = '0';
            if (lineElements.left) lineElements.left.style.opacity = '0';
            if (lineElements.diag2) lineElements.diag2.style.opacity = '0';
            
            await animateDot(dots.d1, dots.d2, animationDuration);
            if (dots.d1.el) dots.d1.el.style.opacity = '0';
            
            await new Promise(resolve => setTimeout(resolve, delayBetweenAnimations));
            if (lineElements.top) lineElements.top.style.opacity = '0';
            if (lineElements.diag1) lineElements.diag1.style.opacity = '0';
            
            await animateDot(dots.d2, dots.d3, animationDuration);
            if (dots.d2.el) dots.d2.el.style.opacity = '0';
            
            await new Promise(resolve => setTimeout(resolve, delayBetweenAnimations));
            if (lineElements.right) lineElements.right.style.opacity = '0';
            
            await animateDot(dots.d3, dots.d4, animationDuration);
            if (dots.d3.el) dots.d3.el.style.opacity = '0';
        }

        async function unfold(): Promise<void> {
            const dots = dotsRef.current;
            if (!dots) return;
            
            dots.d3.x = dots.d4.ox; dots.d3.y = dots.d4.oy;
            updatePositions();
            if (dots.d3.el) dots.d3.el.style.opacity = '1';
            if (lineElements.right) lineElements.right.style.opacity = '1';
            
            await new Promise(resolve => setTimeout(resolve, 50));
            await animateDot(dots.d3, { x: dots.d3.ox, y: dots.d3.oy }, animationDuration);
            await new Promise(resolve => setTimeout(resolve, delayBetweenAnimations));
            
            dots.d2.x = dots.d3.ox; dots.d2.y = dots.d3.oy;
            updatePositions();
            if (dots.d2.el) dots.d2.el.style.opacity = '1';
            if (lineElements.top) lineElements.top.style.opacity = '1';
            if (lineElements.diag1) lineElements.diag1.style.opacity = '1';
            
            await new Promise(resolve => setTimeout(resolve, 50));
            await animateDot(dots.d2, { x: dots.d2.ox, y: dots.d2.oy }, animationDuration);
            await new Promise(resolve => setTimeout(resolve, delayBetweenAnimations));
            
            dots.d1.x = dots.d2.ox; dots.d1.y = dots.d2.oy;
            updatePositions();
            if (dots.d1.el) dots.d1.el.style.opacity = '1';
            if (lineElements.bottom) lineElements.bottom.style.opacity = '1';
            if (lineElements.left) lineElements.left.style.opacity = '1';
            if (lineElements.diag2) lineElements.diag2.style.opacity = '1';
            
            await new Promise(resolve => setTimeout(resolve, 50));
            await animateDot(dots.d1, { x: dots.d1.ox, y: dots.d1.oy }, animationDuration);
            if (loaderRef.current) {
                loaderRef.current.classList.remove('collapsed');
            }
        }

        async function mainLoop(): Promise<void> {
            if (isAnimating.current || !isMounted.current) return;
            isAnimating.current = true;
            
            if (isFolded.current) {
                const dots = dotsRef.current;
                if (dots && dots.d4.el) {
                    await flash(dots.d4.el);
                }
                await unfold();
                isFolded.current = false;
            } else {
                if (centerSquareRef.current) {
                    await flash(centerSquareRef.current);
                }
                await fold();
                isFolded.current = true;
            }

            isAnimating.current = false;
            // Ensure component is still mounted before setting next loop
            if (isMounted.current) {
                animationTimeoutId.current = setTimeout(mainLoop, 200);
            }
        }

        // Initial setup
        const initialize = (): void => {
            const dots = dotsRef.current;
            if (!dots) return;
            
            if (dots.d1.el) dots.d1.el.style.opacity = '0';
            if (dots.d2.el) dots.d2.el.style.opacity = '0';
            if (dots.d3.el) dots.d3.el.style.opacity = '0';
            if (dots.d4.el) dots.d4.el.style.opacity = '1';
            
            for (const key in lineElements) {
                const element = lineElements[key as keyof LineElements];
                if (element) {
                    element.style.opacity = '0';
                }
            }
            
            dots.d1.x = dots.d4.ox; dots.d1.y = dots.d4.oy;
            dots.d2.x = dots.d4.ox; dots.d2.y = dots.d4.oy;
            dots.d3.x = dots.d4.ox; dots.d3.y = dots.d4.oy;
            updatePositions();
            if (loaderRef.current) {
                loaderRef.current.classList.add('collapsed');
            }
            mainLoop();
        };

        initialize();

        // Cleanup function to stop the loop when component unmounts
        return () => {
            isMounted.current = false;
            if (animationTimeoutId.current) {
                clearTimeout(animationTimeoutId.current);
            }
        };
    }, [size, maxCoordinate, centerOffset, dotSize]); // Re-run effect if size changes

    const dotStyle = {
        width: `${dotSize}px`,
        height: `${dotSize}px`,
    };

    return (
        <div 
            ref={loaderRef}
            className="loader-container"
            style={{ width: `${size}px`, height: `${size}px` }}
        >
            <svg className="lines" viewBox={`0 0 ${size} ${size}`}>
                <line ref={(el) => { linesRef.current.top = el; }} />
                <line ref={(el) => { linesRef.current.right = el; }} />
                <line ref={(el) => { linesRef.current.bottom = el; }} />
                <line ref={(el) => { linesRef.current.left = el; }} />
                <line ref={(el) => { linesRef.current.diag1 = el; }} className="diagonal" />
                <line ref={(el) => { linesRef.current.diag2 = el; }} className="diagonal" />
            </svg>

            <div
                ref={centerSquareRef}
                className="center-square"
                style={{ width: `${centerSquareSize}px`, height: `${centerSquareSize}px` }}
            ></div>
            <div ref={d1Ref} className="dot" style={dotStyle}></div> {/* Bottom-left */}
            <div ref={d2Ref} className="dot" style={dotStyle}></div> {/* Top-left */}
            <div ref={d3Ref} className="dot" style={dotStyle}></div> {/* Top-right */}
            <div ref={d4Ref} className="dot" style={dotStyle}></div> {/* Bottom-right */}
        </div>
    );
};

export default FoldingLoader;