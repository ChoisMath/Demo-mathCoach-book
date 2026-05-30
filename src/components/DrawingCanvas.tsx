"use client";

import React, { useRef, useState, useEffect } from "react";
import { Trash2, RotateCcw, Paintbrush, Grid3X3, Eraser, Maximize2, Minimize2 } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  lineWidth: number;
}

interface DrawingCanvasProps {
  onImageChange: (base64Image: string) => void;
  disabled?: boolean;
  initialImage?: string; // Keep for backward compatibility or direct drafts
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  onImageChange,
  disabled = false,
  initialImage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([]); // Undo stack of strokes
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  
  // Brush settings
  const [color, setColor] = useState("#0f172a"); // default slate-900
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  
  // Fullscreen layout state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Scribble gesture detection temporary states
  const scribblePointsRef = useRef<Point[]>([]);
  const turnCountRef = useRef<number>(0);
  const isScribbleRef = useRef<boolean>(false);

  // Convert raw coords to normalized 1000x800 virtual resolution coords
  const toVirtualCoords = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1000,
      y: ((clientY - rect.top) / rect.height) * 800,
    };
  };

  // Convert normalized 1000x800 coords back to actual drawing coordinates
  const fromVirtualCoords = (vx: number, vy: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    // Drawing context is scaled by 2, so our coordinates should align with style (rect.width, rect.height)
    const rect = canvas.getBoundingClientRect();
    return {
      x: (vx / 1000) * rect.width,
      y: (vy / 800) * rect.height,
    };
  };

  // Redraw all strokes on the canvas
  const redraw = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    
    // Clear canvas with white background
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width / 2, canvas.height / 2);

    // Draw all completed strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;
      context.beginPath();
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.lineWidth;
      
      const start = fromVirtualCoords(stroke.points[0].x, stroke.points[0].y);
      context.moveTo(start.x, start.y);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = fromVirtualCoords(stroke.points[i].x, stroke.points[i].y);
        context.lineTo(pt.x, pt.y);
      }
      context.stroke();
    });

    // Draw current active stroke if drawing
    if (isDrawing && currentStroke && currentStroke.points.length > 0) {
      context.beginPath();
      context.strokeStyle = isEraser ? "#f1f5f9" : currentStroke.color; // Show preview of erasing if eraser
      context.lineWidth = currentStroke.lineWidth;
      
      const start = fromVirtualCoords(currentStroke.points[0].x, currentStroke.points[0].y);
      context.moveTo(start.x, start.y);

      for (let i = 1; i < currentStroke.points.length; i++) {
        const pt = fromVirtualCoords(currentStroke.points[i].x, currentStroke.points[i].y);
        context.lineTo(pt.x, pt.y);
      }
      context.stroke();
    }
  };

  // Re-measure and fit canvas to its container
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || 600;
    const h = isFullscreen ? (window.innerHeight - 150) : 400; // fit window on fullscreen

    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = "100%";
    canvas.style.height = `${h}px`;

    const context = canvas.getContext("2d");
    if (context) {
      context.scale(2, 2);
      context.lineCap = "round";
      context.lineJoin = "round";
      contextRef.current = context;
      redraw();
    }
  };

  // Resize canvas when container size change or fullscreen toggle
  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [isFullscreen]);

  // Redraw when strokes change
  useEffect(() => {
    redraw();
    // Export PNG base64 to parent component
    const canvas = canvasRef.current;
    if (canvas) {
      onImageChange(canvas.toDataURL("image/png"));
    }
  }, [strokes]);

  // Stroke-segment intersection distance calculation
  const getDistanceToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const diffX = p.x - a.x;
      const diffY = p.y - a.y;
      return Math.sqrt(diffX * diffX + diffY * diffY);
    }
    
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // clamp to segment bounds
    
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    
    const diffX = p.x - projX;
    const diffY = p.y - projY;
    return Math.sqrt(diffX * diffX + diffY * diffY);
  };

  // Check if a point intersects a completed stroke
  const isPointIntersectingStroke = (p: Point, stroke: Stroke, threshold: number): boolean => {
    for (let i = 1; i < stroke.points.length; i++) {
      const dist = getDistanceToSegment(p, stroke.points[i - 1], stroke.points[i]);
      if (dist <= threshold) {
        return true;
      }
    }
    return false;
  };

  // Check if two bounding boxes overlap
  const doBoundingBoxesOverlap = (strokeA: Stroke, strokeB: Stroke, padding: number): boolean => {
    const getBounds = (s: Stroke) => {
      let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
      s.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      return { minX, maxX, minY, maxY };
    };

    const boxA = getBounds(strokeA);
    const boxB = getBounds(strokeB);

    return !(
      boxA.maxX < boxB.minX - padding ||
      boxA.minX > boxB.maxX + padding ||
      boxA.maxY < boxB.minY - padding ||
      boxA.minY > boxB.maxY + padding
    );
  };

  // Erase strokes intersecting with an eraser path point
  const eraseStrokesAt = (vPoint: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Eraser brush radius in virtual coords
    const eraserVirtualRadius = ((lineWidth + 25) / rect.width) * 1000;

    setStrokes((prevStrokes) => {
      const filtered = prevStrokes.filter((stroke) => {
        // Check intersection
        const isIntersecting = isPointIntersectingStroke(vPoint, stroke, eraserVirtualRadius);
        return !isIntersecting; // keep if not intersecting
      });

      // Push history if a stroke was deleted
      if (filtered.length !== prevStrokes.length) {
        setHistory((h) => [...h, filtered]);
      }
      return filtered;
    });
  };

  // Mouse & Touch coords retriever
  const getClientCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  // Start drawing handler
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (e.cancelable) e.preventDefault();

    const coords = getClientCoords(e);
    if (!coords) return;

    const vPoint = toVirtualCoords(coords.clientX, coords.clientY);
    const canvas = canvasRef.current;
    const context = contextRef.current;
    
    if (canvas && context) {
      const actualPt = fromVirtualCoords(vPoint.x, vPoint.y);
      context.beginPath();
      context.moveTo(actualPt.x, actualPt.y);
      context.strokeStyle = isEraser ? "#f1f5f9" : color;
      context.lineWidth = lineWidth;
      
      setIsDrawing(true);
      
      const newStroke: Stroke = {
        points: [vPoint],
        color: isEraser ? "#ffffff" : color,
        lineWidth: lineWidth,
      };
      setCurrentStroke(newStroke);

      // Reset scribble gesture states
      scribblePointsRef.current = [vPoint];
      turnCountRef.current = 0;
      isScribbleRef.current = false;

      if (isEraser) {
        eraseStrokesAt(vPoint);
      }
    }
  };

  // Drawing in progress handler
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    if (e.cancelable) e.preventDefault();

    const coords = getClientCoords(e);
    if (!coords) return;

    const vPoint = toVirtualCoords(coords.clientX, coords.clientY);
    const canvas = canvasRef.current;
    const context = contextRef.current;

    if (canvas && context && currentStroke) {
      // Draw locally in real-time
      const actualPt = fromVirtualCoords(vPoint.x, vPoint.y);
      context.lineTo(actualPt.x, actualPt.y);
      context.stroke();

      // Store point in current stroke
      const updatedPoints = [...currentStroke.points, vPoint];
      setCurrentStroke({ ...currentStroke, points: updatedPoints });

      // Handle eraser drag
      if (isEraser) {
        eraseStrokesAt(vPoint);
      } else {
        // Scribble Eraser Gesture Detection
        const scribblePoints = scribblePointsRef.current;
        const lastPt = scribblePoints[scribblePoints.length - 1];
        
        // Measure Euclidean distance in virtual coords
        const dist = Math.sqrt(Math.pow(vPoint.x - lastPt.x, 2) + Math.pow(vPoint.y - lastPt.y, 2));
        
        if (dist > 15) { // Subsample turns every 15 virtual units
          scribblePoints.push(vPoint);
          
          if (scribblePoints.length >= 3) {
            const n = scribblePoints.length;
            const a = scribblePoints[n - 3];
            const b = scribblePoints[n - 2];
            const c = scribblePoints[n - 1];

            // Direction vectors
            const v1 = { x: b.x - a.x, y: b.y - a.y };
            const v2 = { x: c.x - b.x, y: c.y - b.y };

            const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
            const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
            const dot = v1.x * v2.x + v1.y * v2.y;

            if (len1 > 0 && len2 > 0) {
              const cosTheta = dot / (len1 * len2);
              
              // Angle is between 70deg and 180deg (direction reversal)
              if (cosTheta < -0.3) {
                turnCountRef.current += 1;
                
                // If 5+ rapid zig-zags are drawn, it is a scribble gesture!
                if (turnCountRef.current >= 5) {
                  isScribbleRef.current = true;
                }
              }
            }
          }
        }
      }
    }
  };

  // Drawing complete handler
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke && currentStroke.points.length > 0) {
      if (isScribbleRef.current && !isEraser) {
        // Trigger Scribble Erasing!
        const scribbleStroke = currentStroke;
        
        setStrokes((prevStrokes) => {
          const filtered = prevStrokes.filter((stroke) => {
            // 1. Check bounding box overlap first for performance
            const isBoxOverlap = doBoundingBoxesOverlap(scribbleStroke, stroke, 30);
            if (!isBoxOverlap) return true;

            // 2. Exact distance check: any point in the stroke is within 30 virtual units of any scribble segment
            const isScribbled = stroke.points.some((p) => {
              for (let i = 1; i < scribbleStroke.points.length; i++) {
                const dist = getDistanceToSegment(p, scribbleStroke.points[i - 1], scribbleStroke.points[i]);
                if (dist < 35) return true;
              }
              return false;
            });

            return !isScribbled; // Delete if scribbled
          });

          // Store history
          setHistory((h) => [...h, filtered]);
          return filtered;
        });

        // Trigger visual redraw without adding the scribble stroke itself
        setCurrentStroke(null);
        setTimeout(() => redraw(), 10);
      } else if (!isEraser) {
        // Standard Stroke saving
        const newStrokes = [...strokes, currentStroke];
        setStrokes(newStrokes);
        setHistory((h) => [...h, newStrokes]);
      }
    }

    setCurrentStroke(null);
    redraw();
  };

  // Undo drawing
  const handleUndo = () => {
    if (disabled || history.length === 0) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    setHistory(newHistory);

    const prevStrokes = newHistory.length === 0 ? [] : newHistory[newHistory.length - 1];
    setStrokes(prevStrokes);
  };

  // Clear drawing
  const handleClear = () => {
    if (disabled) return;
    setStrokes([]);
    setHistory((h) => [...h, []]);
  };

  // Color Palette
  const colors = [
    { value: "#0f172a", label: "Black" }, // slate-900
    { value: "#2563eb", label: "Blue" },  // blue-600
    { value: "#dc2626", label: "Red" },   // red-600
    { value: "#16a34a", label: "Green" }, // green-600
  ];

  // Outer Wrapper layout style depends on Fullscreen state
  const wrapperClasses = isFullscreen
    ? "fixed inset-0 z-50 bg-white p-6 flex flex-col space-y-4"
    : "border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white";

  return (
    <div className={wrapperClasses}>
      
      {/* Tool Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none rounded-t-xl">
        
        {/* Colors & Eraser */}
        <div className="flex items-center space-x-2">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                setColor(c.value);
                setIsEraser(false);
              }}
              style={{ backgroundColor: c.value }}
              className={`w-6 h-6 rounded-full border cursor-pointer hover:scale-110 transition-transform ${
                color === c.value && !isEraser
                  ? "ring-2 ring-blue-500 ring-offset-1 border-white"
                  : "border-slate-300"
              }`}
              title={c.label}
            />
          ))}
          <div className="h-6 w-px bg-slate-200 mx-1" />
          
          {/* Eraser Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsEraser(true)}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              isEraser
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
            title="획 지우개"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>

        {/* Thickness & Grid */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <Paintbrush className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="range"
              min="1"
              max="15"
              value={lineWidth}
              disabled={disabled}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-16 md:w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[10px] font-bold text-slate-500 w-4">{lineWidth}</span>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              showGrid
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
            title="격자 눈금 표시"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>

        {/* Actions (Clear, Undo, Fullscreen) */}
        <div className="flex items-center space-x-1.5 ml-auto">
          {/* Undo */}
          <button
            type="button"
            disabled={disabled || history.length === 0}
            onClick={handleUndo}
            className="p-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            title="실행 취소 (Undo)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Clear */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleClear}
            className="p-1.5 bg-white text-red-500 border border-slate-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            title="전체 지우기"
          >
            <Trash2 className="h-4 w-4" />
          </button>


        </div>
      </div>

      {/* Canvas Area */}
      <div 
        className="relative bg-white flex-1 border border-slate-200 border-t-0 rounded-b-xl"
        style={{ height: isFullscreen ? "auto" : "400px" }}
      >
        {/* Fullscreen / Minimize Toggle Button */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-3 right-3 z-20 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg shadow-md flex items-center justify-center transition-colors cursor-pointer"
          title={isFullscreen ? "화면 축소" : "화면 확대"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </button>

        {/* Math Grid background using pure CSS */}
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-40 rounded-b-xl"
            style={{
              backgroundImage: `
                linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px"
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`block w-full h-full cursor-crosshair rounded-b-xl ${
            disabled ? "opacity-75 cursor-not-allowed" : ""
          }`}
        />
      </div>

      {/* Instructions helper overlay in Fullscreen */}
      {isFullscreen && (
        <div className="text-[11px] text-slate-400 text-center font-semibold">
          💡 Z(갈지자) 모양으로 마구 칠하면 칠한 획들이 자동으로 지워집니다 (Scribble-to-erase). 축소하려면 우상단 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
};
