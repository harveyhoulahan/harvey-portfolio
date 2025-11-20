"use client"

import React, { CSSProperties, forwardRef, useRef } from "react"
import { useAnimationFrame } from "framer-motion"
import { useMousePositionRef } from "@/hooks/use-mouse-position-ref"

// Helper type that makes all properties of CSSProperties accept number | string
type CSSPropertiesWithValues = {
  [K in keyof CSSProperties]: string | number
}

interface StyleValue<T extends keyof CSSPropertiesWithValues> {
  from: CSSPropertiesWithValues[T]
  to: CSSPropertiesWithValues[T]
}

interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string
  styles: Partial<{
    [K in keyof CSSPropertiesWithValues]: StyleValue<K>
  }>
  containerRef: React.RefObject<HTMLDivElement>
  radius?: number
  falloff?: "linear" | "exponential" | "gaussian"
}

const TextCursorProximity = forwardRef<HTMLSpanElement, TextProps>(
  (
    {
      label,
      styles,
      containerRef,
      radius = 50,
      falloff = "linear",
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
    const mousePositionRef = useMousePositionRef(containerRef)
    
    const calculateDistance = (
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): number => {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    }

    const calculateFalloff = (distance: number): number => {
      const normalizedDistance = Math.min(Math.max(1 - distance / radius, 0), 1)

      switch (falloff) {
        case "exponential":
          return Math.pow(normalizedDistance, 2)
        case "gaussian":
          return Math.exp(-Math.pow(distance / (radius / 2), 2) / 2)
        case "linear":
        default:
          return normalizedDistance
      }
    }

    const interpolateValue = (from: any, to: any, progress: number): any => {
      // Handle transform values
      if (typeof from === 'string' && typeof to === 'string') {
        // Parse scale values
        const scaleMatch1 = from.match(/scale\(([\d.]+)\)/)
        const scaleMatch2 = to.match(/scale\(([\d.]+)\)/)
        if (scaleMatch1 && scaleMatch2) {
          const fromScale = parseFloat(scaleMatch1[1])
          const toScale = parseFloat(scaleMatch2[1])
          const interpolated = fromScale + (toScale - fromScale) * progress
          return `scale(${interpolated})`
        }
        return progress > 0.5 ? to : from
      }
      
      // Handle color values (both hex and rgba)
      if (typeof from === 'string' && from.startsWith('#')) {
        const fromRgb = parseInt(from.slice(1), 16)
        const toRgb = typeof to === 'string' && to.startsWith('#') ? parseInt(to.slice(1), 16) : fromRgb
        const r1 = (fromRgb >> 16) & 255
        const g1 = (fromRgb >> 8) & 255
        const b1 = fromRgb & 255
        const r2 = (toRgb >> 16) & 255
        const g2 = (toRgb >> 8) & 255
        const b2 = toRgb & 255
        const r = Math.round(r1 + (r2 - r1) * progress)
        const g = Math.round(g1 + (g2 - g1) * progress)
        const b = Math.round(b1 + (b2 - b1) * progress)
        return `rgba(${r}, ${g}, ${b}, 1)`
      }
      
      // Handle numeric values
      if (typeof from === 'number' && typeof to === 'number') {
        return from + (to - from) * progress
      }
      
      return from
    }

    useAnimationFrame(() => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()

      letterRefs.current.forEach((letterRef) => {
        if (!letterRef) return

        const rect = letterRef.getBoundingClientRect()
        const letterCenterX = rect.left + rect.width / 2 - containerRect.left
        const letterCenterY = rect.top + rect.height / 2 - containerRect.top

        const distance = calculateDistance(
          mousePositionRef.current.x,
          mousePositionRef.current.y,
          letterCenterX,
          letterCenterY
        )

        const proximity = calculateFalloff(distance)
        
        // Apply styles directly to DOM
        Object.entries(styles).forEach(([key, value]) => {
          if (value) {
            const interpolated = interpolateValue(value.from, value.to, proximity)
            letterRef.style[key as any] = interpolated
          }
        })
      })
    })

    const words = label.split(" ")
    let letterIndex = 0

    return (
      <span
        ref={ref}
        className={`${className} inline`}
        onClick={onClick}
        {...props}
      >
        {words.map((word, wordIndex) => (
          <span key={wordIndex} className="inline-block whitespace-nowrap">
            {word.split("").map((letter) => {
              const currentLetterIndex = letterIndex++

              return (
                <span
                  key={currentLetterIndex}
                  ref={(el: HTMLSpanElement | null) => {
                    letterRefs.current[currentLetterIndex] = el
                  }}
                  className="inline-block"
                  aria-hidden="true"
                >
                  {letter}
                </span>
              )
            })}
            {wordIndex < words.length - 1 && (
              <span className="inline-block">&nbsp;</span>
            )}
          </span>
        ))}
        <span className="sr-only">{label}</span>
      </span>
    )
  }
)

TextCursorProximity.displayName = "TextCursorProximity"
export default TextCursorProximity
