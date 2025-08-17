'use client'

import * as React from "react"
import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Topic {
  id: string
  name: string
  knowledgePointCount: number
  confidenceScore: number
  isNew?: boolean
}

interface TopicNode extends Topic {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  glowIntensity: number
  isExploded?: boolean
}

interface KnowledgePoint {
  id: string
  summary: string
  keywords: string[]
  content?: string
  platform: string
  sourceType: string
  externalUrl?: string
  authorName?: string
  createdAt: string
}

interface KnowledgePointNode extends KnowledgePoint {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  parentTopicId: string
  targetX?: number
  targetY?: number
}

interface TopicGraphProps {
  topics: Topic[]
}

export function TopicGraph({ topics }: TopicGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const [nodes, setNodes] = useState<TopicNode[]>([])
  const [knowledgePointNodes, setKnowledgePointNodes] = useState<KnowledgePointNode[]>([])
  const [explodedTopicId, setExplodedTopicId] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<TopicNode | null>(null)
  const [selectedKnowledgePoint, setSelectedKnowledgePoint] = useState<KnowledgePointNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 })

  // Helper function to get actual color values from CSS variables
  const getActualColor = (topic: Topic): string => {
    // Use actual hex colors that work with Canvas
    if (topic.isNew) return '#a3be8c' // Nord14 - Aurora Green
    if (topic.confidenceScore > 0.8) return '#81a1c1' // Nord9 - Frost Blue
    return '#88c0d0' // Nord8 - Frost
  }

  // Get color for knowledge points based on platform
  const getKnowledgePointColor = (platform: string): string => {
    switch (platform.toLowerCase()) {
      case 'slack': return '#bf616a' // Nord11 - Aurora Red  
      case 'github': return '#d08770' // Nord12 - Aurora Orange
      default: return '#ebcb8b' // Nord13 - Aurora Yellow
    }
  }

  // Fetch knowledge points for a topic
  const fetchKnowledgePointsForTopic = async (topicId: string): Promise<KnowledgePoint[]> => {
    try {
      const response = await fetch(`/api/topics/${topicId}/knowledge-points`)
      if (!response.ok) throw new Error('Failed to fetch knowledge points')
      const data = await response.json()
      return data.knowledgePoints || []
    } catch (error) {
      console.error('Error fetching knowledge points:', error)
      return []
    }
  }

  // Explode topic into knowledge points
  const explodeTopic = async (topicNode: TopicNode) => {
    // If same topic is clicked, unexplode it
    if (explodedTopicId === topicNode.id) {
      recomposeTopic()
      return
    }

    // If another topic is exploded, recompose it first
    if (explodedTopicId && explodedTopicId !== topicNode.id) {
      await recomposeTopic()
    }

    const knowledgePoints = await fetchKnowledgePointsForTopic(topicNode.id)
    if (!knowledgePoints.length) return

    // Mark topic as exploded
    setExplodedTopicId(topicNode.id)
    setNodes(prev => prev.map(node => 
      node.id === topicNode.id 
        ? { ...node, isExploded: true }
        : node
    ))

    // Create knowledge point nodes arranged in a circle around the topic
    const newKnowledgePointNodes: KnowledgePointNode[] = knowledgePoints.map((kp, index) => {
      const angle = (index / knowledgePoints.length) * Math.PI * 2
      const distance = topicNode.radius + 60 + (Math.random() * 40) // Spread them out
      
      return {
        ...kp,
        x: topicNode.x, // Start at topic center
        y: topicNode.y,
        vx: Math.cos(angle) * 3, // Initial velocity outward
        vy: Math.sin(angle) * 3,
        radius: Math.max(8, Math.min(20, kp.summary.length / 10)), // Size based on content
        color: getKnowledgePointColor(kp.platform),
        parentTopicId: topicNode.id,
        targetX: topicNode.x + Math.cos(angle) * distance, // Target position
        targetY: topicNode.y + Math.sin(angle) * distance
      }
    })

    setKnowledgePointNodes(newKnowledgePointNodes)
  }

  // Recompose knowledge points back into topic
  const recomposeTopic = () => {
    if (!explodedTopicId) return

    // Animate knowledge points back to topic center
    setKnowledgePointNodes(prev => prev.map(kp => ({
      ...kp,
      targetX: nodes.find(n => n.id === kp.parentTopicId)?.x || kp.x,
      targetY: nodes.find(n => n.id === kp.parentTopicId)?.y || kp.y
    })))

    // After animation, remove knowledge points and mark topic as not exploded
    setTimeout(() => {
      setKnowledgePointNodes([])
      setExplodedTopicId(null)
      setNodes(prev => prev.map(node => ({ ...node, isExploded: false })))
    }, 800) // Match animation duration
  }

  // Set up canvas with proper resolution
  const setupCanvas = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const devicePixelRatio = window.devicePixelRatio || 1

    // Prevent resize loop - only update if dimensions actually changed
    const newWidth = rect.width
    const newHeight = rect.height
    
    if (newWidth === canvasDimensions.width && newHeight === canvasDimensions.height) {
      return // No change, avoid triggering resize loop
    }

    // Set actual canvas size (for drawing)
    canvas.width = newWidth * devicePixelRatio
    canvas.height = newHeight * devicePixelRatio

    // Set display size (CSS pixels) - but don't let canvas control container size
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    // Scale context to match device pixel ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }

    setCanvasDimensions({ width: newWidth, height: newHeight })
  }

  // Handle canvas resize
  useEffect(() => {
    setupCanvas()

    const handleResize = () => setupCanvas()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Update canvas when container size changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let resizeTimeoutId: NodeJS.Timeout

    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize events to prevent loops
      clearTimeout(resizeTimeoutId)
      resizeTimeoutId = setTimeout(() => {
        setupCanvas()
      }, 16) // ~60fps
    })

    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      clearTimeout(resizeTimeoutId)
    }
  }, [])

  // Initialize nodes from topics
  useEffect(() => {
    if (!topics.length) return

    const centerX = canvasDimensions.width / 2
    const centerY = canvasDimensions.height / 2

    const newNodes: TopicNode[] = topics.map((topic, index) => {
      // Calculate radius based on knowledge point count (more points = bigger node)
      const radius = Math.max(20, Math.min(80, topic.knowledgePointCount * 1.5))
      
      // Arrange in a spiral pattern initially
      const angle = (index / topics.length) * Math.PI * 2
      const distance = 100 + (index * 30)
      
      // Color based on confidence and newness
      const color = getActualColor(topic)
      
      return {
        ...topic,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius,
        color,
        glowIntensity: topic.isNew ? 1.5 : 1
      }
    })

    setNodes(newNodes)
  }, [topics, canvasDimensions])

  // Physics simulation
  useEffect(() => {
    if (!nodes.length && !knowledgePointNodes.length) return

    const animate = () => {
      // Animate topic nodes
      setNodes(prevNodes => {
        if (!prevNodes.length) return prevNodes
        
        return prevNodes.map(node => {
          // Skip physics for exploded topics (they stay in place)
          if (node.isExploded) return node

          // Apply forces
          let fx = 0, fy = 0

          // Repulsion from other nodes
          prevNodes.forEach(other => {
            if (other.id === node.id || other.isExploded) return
            
            const dx = node.x - other.x
            const dy = node.y - other.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance > 0 && distance < 200) {
              const force = (200 - distance) / distance * 0.5
              fx += dx * force
              fy += dy * force
            }
          })

          // Attraction to center (gentle)
          const centerX = canvasDimensions.width / 2
          const centerY = canvasDimensions.height / 2
          const toCenterX = centerX - node.x
          const toCenterY = centerY - node.y
          fx += toCenterX * 0.001
          fy += toCenterY * 0.001

          // Update velocity with damping
          const newVx = (node.vx + fx) * 0.95
          const newVy = (node.vy + fy) * 0.95

          // Update position
          const newX = node.x + newVx
          const newY = node.y + newVy

          return {
            ...node,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy
          }
        })
      })

      // Animate knowledge point nodes
      setKnowledgePointNodes(prevKnowledgePoints => {
        if (!prevKnowledgePoints.length) return prevKnowledgePoints

        return prevKnowledgePoints.map(kp => {
          let fx = 0, fy = 0

          // If we have a target position, move towards it
          if (kp.targetX !== undefined && kp.targetY !== undefined) {
            const dx = kp.targetX - kp.x
            const dy = kp.targetY - kp.y
            fx += dx * 0.1 // Attraction to target
            fy += dy * 0.1
          }

          // Repulsion from other knowledge points
          prevKnowledgePoints.forEach(other => {
            if (other.id === kp.id) return
            
            const dx = kp.x - other.x
            const dy = kp.y - other.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance > 0 && distance < 40) {
              const force = (40 - distance) / distance * 0.3
              fx += dx * force
              fy += dy * force
            }
          })

          // Update velocity with damping
          const newVx = (kp.vx + fx) * 0.92
          const newVy = (kp.vy + fy) * 0.92

          // Update position
          const newX = kp.x + newVx
          const newY = kp.y + newVy

          return {
            ...kp,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy
          }
        })
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    // Start animation whenever we have nodes
    const timeoutId = setTimeout(animate, 100)

    return () => {
      clearTimeout(timeoutId)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes.length, knowledgePointNodes.length, canvasDimensions])

  // Render the graph
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    // Clear canvas (use CSS dimensions, not canvas.width/height which are scaled)
    ctx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height)

    // Apply zoom and pan
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Draw connections between related topics (only non-exploded ones)
    nodes.filter(node => !node.isExploded).forEach((node, i) => {
      nodes.filter(other => !other.isExploded).slice(i + 1).forEach(other => {
        const similarity = calculateTopicSimilarity(node.name, other.name)
        
        if (similarity > 0.3) {
          ctx.beginPath()
          ctx.strokeStyle = `rgba(136, 192, 208, ${similarity * 0.3})`
          ctx.lineWidth = 1
          ctx.moveTo(node.x, node.y)
          ctx.lineTo(other.x, other.y)
          ctx.stroke()
        }
      })
    })

    // Draw topic nodes
    nodes.forEach(node => {
      // Dim exploded topics
      const opacity = node.isExploded ? 0.3 : 1
      
      // Glow effect
      const gradient = ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, node.radius * 2
      )
      gradient.addColorStop(0, `${node.color}${Math.round(0x40 * opacity).toString(16).padStart(2, '0')}`)
      gradient.addColorStop(1, 'transparent')
      
      ctx.beginPath()
      ctx.fillStyle = gradient
      ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2)
      ctx.fill()

      // Main node
      ctx.beginPath()
      ctx.fillStyle = node.color
      ctx.globalAlpha = opacity
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      // Border
      ctx.beginPath()
      ctx.strokeStyle = '#eceff4'
      ctx.lineWidth = 2
      ctx.globalAlpha = opacity
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1

      // Knowledge point count indicator (hide if exploded)
      if (!node.isExploded) {
        ctx.fillStyle = '#2e3440'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          node.knowledgePointCount.toString(),
          node.x,
          node.y
        )
      }
    })

    // Draw knowledge point nodes
    knowledgePointNodes.forEach(kp => {
      // Glow effect for knowledge points
      const gradient = ctx.createRadialGradient(
        kp.x, kp.y, 0,
        kp.x, kp.y, kp.radius * 1.5
      )
      gradient.addColorStop(0, `${kp.color}60`)
      gradient.addColorStop(1, 'transparent')
      
      ctx.beginPath()
      ctx.fillStyle = gradient
      ctx.arc(kp.x, kp.y, kp.radius * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Main knowledge point
      ctx.beginPath()
      ctx.fillStyle = kp.color
      ctx.arc(kp.x, kp.y, kp.radius, 0, Math.PI * 2)
      ctx.fill()

      // Border
      ctx.beginPath()
      ctx.strokeStyle = '#eceff4'
      ctx.lineWidth = 1
      ctx.arc(kp.x, kp.y, kp.radius, 0, Math.PI * 2)
      ctx.stroke()

      // Platform indicator
      ctx.fillStyle = '#2e3440'
      ctx.font = 'bold 8px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        kp.platform.charAt(0).toUpperCase(),
        kp.x,
        kp.y
      )
    })

    ctx.restore()
  }, [nodes, knowledgePointNodes, zoom, pan, canvasDimensions])

  // Helper function to calculate topic similarity
  const calculateTopicSimilarity = (name1: string, name2: string): number => {
    const words1 = name1.toLowerCase().split(' ')
    const words2 = name2.toLowerCase().split(' ')
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 3)
    return commonWords.length / Math.max(words1.length, words2.length)
  }

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    } else {
      // Check for hover with proper coordinate transformation
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      
      // Convert mouse coordinates to canvas coordinates (accounting for pan and zoom)
      const mouseX = (e.clientX - rect.left - pan.x) / zoom
      const mouseY = (e.clientY - rect.top - pan.y) / zoom

      // Check for hovered knowledge point first (they're smaller and on top)
      const hoveredKnowledgePoint = knowledgePointNodes.find(kp => {
        const distance = Math.sqrt(
          (mouseX - kp.x) ** 2 + (mouseY - kp.y) ** 2
        )
        return distance <= kp.radius
      })

      if (hoveredKnowledgePoint) {
        setSelectedKnowledgePoint(hoveredKnowledgePoint)
        setSelectedTopic(null)
        canvas.style.cursor = 'pointer'
        return
      }

      // Check for hovered topic node
      const hoveredNode = nodes.find(node => {
        const distance = Math.sqrt(
          (mouseX - node.x) ** 2 + (mouseY - node.y) ** 2
        )
        return distance <= node.radius
      })

      setSelectedTopic(hoveredNode || null)
      setSelectedKnowledgePoint(null)
      canvas.style.cursor = hoveredNode ? 'pointer' : 'grab'
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return // Don't handle clicks during drag

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - pan.x) / zoom
    const mouseY = (e.clientY - rect.top - pan.y) / zoom

    // Check for clicked topic node
    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt(
        (mouseX - node.x) ** 2 + (mouseY - node.y) ** 2
      )
      return distance <= node.radius
    })

    if (clickedNode) {
      explodeTopic(clickedNode)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.3, Math.min(3, prev * zoomFactor)))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-background to-secondary border"
    >
      {/* Controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
          className="backdrop-blur-sm"
        >
          <ZoomIn className="h-4 w-4" />
          <span className="sr-only">Zoom in</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setZoom(prev => Math.max(0.3, prev * 0.8))}
          className="backdrop-blur-sm"
        >
          <ZoomOut className="h-4 w-4" />
          <span className="sr-only">Zoom out</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={resetView}
          className="backdrop-blur-sm"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="sr-only">Reset view</span>
        </Button>
      </div>

      {/* Graph Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Info Panel - Topic or Knowledge Point */}
      {(selectedTopic || selectedKnowledgePoint) && (
        <div className="absolute top-3 right-3 z-10">
          <Card className="backdrop-blur-sm min-w-[280px] max-w-[320px]">
            <CardContent className="p-4">
              {selectedTopic && !selectedKnowledgePoint && (
                <>
                  <h3 className="font-semibold text-base sm:text-lg leading-tight mb-2 line-clamp-2">
                    {selectedTopic.name}
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Knowledge Points:</span>
                      <span className="font-medium">{selectedTopic.knowledgePointCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-medium">{Math.round(selectedTopic.confidenceScore * 100)}%</span>
                    </div>
                    {selectedTopic.isNew && (
                      <Badge variant="outline" className="mt-2">
                        Newly Discovered
                      </Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-3 p-2 bg-secondary/30 rounded">
                      💡 Click to explode into knowledge points
                    </div>
                  </div>
                </>
              )}
              
              {selectedKnowledgePoint && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedKnowledgePoint.platform}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {selectedKnowledgePoint.sourceType}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-sm sm:text-base leading-tight mb-2 line-clamp-3">
                    {selectedKnowledgePoint.summary}
                  </h3>
                  
                  <div className="space-y-2 text-xs">
                    {selectedKnowledgePoint.authorName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Author:</span>
                        <span className="font-medium">{selectedKnowledgePoint.authorName}</span>
                      </div>
                    )}
                    
                    {selectedKnowledgePoint.keywords && selectedKnowledgePoint.keywords.length > 0 && (
                      <div>
                        <span className="text-muted-foreground block mb-1">Keywords:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedKnowledgePoint.keywords.slice(0, 3).map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedKnowledgePoint.createdAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-medium">
                          {new Date(selectedKnowledgePoint.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    
                    {selectedKnowledgePoint.externalUrl && (
                      <div className="mt-2">
                        <a
                          href={selectedKnowledgePoint.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-600 underline"
                        >
                          View Source →
                        </a>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-3 left-3 text-xs text-muted-foreground">
        Drag to pan • Scroll to zoom • Hover topics for details
      </div>
    </div>
  )
}
