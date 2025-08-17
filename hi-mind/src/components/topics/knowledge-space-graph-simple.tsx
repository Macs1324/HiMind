'use client'

import * as React from "react"
import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface KnowledgePoint {
  id: string
  summary: string
  keywords: string[]
  platform: string
  sourceType: string
  externalUrl?: string
  authorName?: string
  createdAt: string
  qualityScore: number
}

interface KnowledgePointNode extends KnowledgePoint {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

interface KnowledgeSpaceGraphProps {
  className?: string
}

export function KnowledgeSpaceGraph({ className }: KnowledgeSpaceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  
  const [nodes, setNodes] = useState<KnowledgePointNode[]>([])
  const [selectedNode, setSelectedNode] = useState<KnowledgePointNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 })

  // Color mapping for different platforms
  const getPlatformColor = (platform: string): string => {
    switch (platform.toLowerCase()) {
      case 'slack': return '#e06c75' // Red
      case 'github': return '#98c379' // Green  
      default: return '#61afef' // Blue
    }
  }

  // Fetch all knowledge points (simplified - no embeddings for now)
  const fetchKnowledgePoints = async (): Promise<KnowledgePoint[]> => {
    try {
      setLoading(true)
      const response = await fetch('/api/knowledge-points/embeddings')
      if (!response.ok) throw new Error('Failed to fetch knowledge points')
      const data = await response.json()
      return data.knowledgePoints || []
    } catch (error) {
      console.error('Error fetching knowledge points:', error)
      return []
    } finally {
      setLoading(false)
    }
  }

  // Ultra-simple canvas setup - no DPI scaling
  const setupCanvas = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const width = Math.floor(rect.width)
    const height = Math.floor(rect.height)
    
    if (width === canvasDimensions.width && height === canvasDimensions.height) {
      return
    }

    // Set canvas size directly - no scaling
    canvas.width = width
    canvas.height = height
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'

    console.log('Canvas setup:', { width, height })
    setCanvasDimensions({ width, height })
  }

  // Initialize knowledge points with simple random positioning
  useEffect(() => {
    const initializeGraph = async () => {
      const knowledgePoints = await fetchKnowledgePoints()
      if (!knowledgePoints.length) return

      const centerX = canvasDimensions.width / 2
      const centerY = canvasDimensions.height / 2
      
      const newNodes: KnowledgePointNode[] = knowledgePoints.map((kp, index) => {
        const radius = Math.max(8, Math.min(20, kp.summary.length / 15))
        
        // Simple spiral arrangement for now
        const angle = (index / knowledgePoints.length) * Math.PI * 2
        const distance = 50 + (index * 3)
        
        return {
          ...kp,
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          radius,
          color: getPlatformColor(kp.platform)
        }
      })

      setNodes(newNodes)
    }

    if (canvasDimensions.width > 0) {
      initializeGraph()
    }
  }, [canvasDimensions])

  // Canvas setup (copied from working TopicGraph)
  useEffect(() => {
    setupCanvas()
    const handleResize = () => setupCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Simple physics simulation (simplified version)
  useEffect(() => {
    if (!nodes.length) return

    const animate = () => {
      setNodes(prevNodes => {
        return prevNodes.map(node => {
          let fx = 0, fy = 0

          // Simple repulsion from other nodes
          prevNodes.forEach(other => {
            if (other.id === node.id) return
            
            const dx = node.x - other.x
            const dy = node.y - other.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance > 0 && distance < 100) {
              const force = (100 - distance) / distance * 0.1
              fx += dx * force
              fy += dy * force
            }
          })

          // Gentle attraction to center
          const centerX = canvasDimensions.width / 2
          const centerY = canvasDimensions.height / 2
          fx += (centerX - node.x) * 0.0005
          fy += (centerY - node.y) * 0.0005

          // Update velocity with damping
          const newVx = (node.vx + fx) * 0.95
          const newVy = (node.vy + fy) * 0.95

          return {
            ...node,
            x: node.x + newVx,
            y: node.y + newVy,
            vx: newVx,
            vy: newVy
          }
        })
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    const timeoutId = setTimeout(animate, 100)
    return () => {
      clearTimeout(timeoutId)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes.length, canvasDimensions])

  // Render the graph with crisp vector drawing
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    // Enable crisp rendering
    ctx.imageSmoothingEnabled = false
    
    ctx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height)

    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Draw knowledge point nodes with crisp rendering
    nodes.forEach(node => {
      // Main node - use integer coordinates for crisp edges
      const x = Math.round(node.x)
      const y = Math.round(node.y)
      const radius = Math.round(node.radius)

      // Glow effect
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2)
      gradient.addColorStop(0, `${node.color}40`)
      gradient.addColorStop(1, 'transparent')
      
      ctx.beginPath()
      ctx.fillStyle = gradient
      ctx.arc(x, y, radius * 2, 0, Math.PI * 2)
      ctx.fill()

      // Main node with crisp edges
      ctx.beginPath()
      ctx.fillStyle = node.color
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()

      // Border with pixel-perfect positioning
      ctx.beginPath()
      ctx.strokeStyle = '#eceff4'
      ctx.lineWidth = 2
      ctx.arc(x, y, radius - 0.5, 0, Math.PI * 2)
      ctx.stroke()

      // Platform indicator with crisp text
      ctx.fillStyle = '#2e3440'
      ctx.font = 'bold 10px monospace' // Use monospace for crispness
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        node.platform.charAt(0).toUpperCase(),
        x,
        y
      )
    })

    ctx.restore()
  }, [nodes, zoom, pan, canvasDimensions])

  // Mouse handlers with correct coordinate calculation
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    } else {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      
      // Calculate mouse position relative to canvas, accounting for pan and zoom
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      
      // Transform to world coordinates
      const worldX = (canvasX - pan.x) / zoom
      const worldY = (canvasY - pan.y) / zoom

      console.log('Mouse:', { canvasX, canvasY, worldX, worldY, pan, zoom })

      const hoveredNode = nodes.find(node => {
        const distance = Math.sqrt(
          (worldX - node.x) ** 2 + (worldY - node.y) ** 2
        )
        const isHovered = distance <= node.radius
        if (isHovered) {
          console.log('Hovering node:', node.summary.substring(0, 30), { distance, radius: node.radius })
        }
        return isHovered
      })

      setSelectedNode(hoveredNode || null)
      canvas.style.cursor = hoveredNode ? 'pointer' : 'grab'
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full rounded-lg border bg-gradient-to-br from-background to-secondary">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading knowledge points...</p>
        </div>
      </div>
    )
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
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setZoom(prev => Math.max(0.3, prev * 0.8))}
          className="backdrop-blur-sm"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={resetView}
          className="backdrop-blur-sm"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Info Panel */}
      {selectedNode && (
        <div className="absolute top-3 right-3 z-10">
          <Card className="backdrop-blur-sm min-w-[300px] max-w-[400px]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {selectedNode.platform}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {selectedNode.sourceType}
                </Badge>
              </div>
              
              <h3 className="font-semibold text-sm leading-tight mb-2">
                {selectedNode.summary}
              </h3>
              
              <div className="space-y-2 text-xs">
                {selectedNode.authorName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Author:</span>
                    <span className="font-medium">{selectedNode.authorName}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quality:</span>
                  <span className="font-medium">{Math.round(selectedNode.qualityScore * 100)}%</span>
                </div>
                
                {selectedNode.keywords.length > 0 && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Keywords:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.keywords.slice(0, 3).map((keyword, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
        {nodes.length} knowledge points
      </div>
    </div>
  )
}