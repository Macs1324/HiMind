'use client'

import * as React from "react"
import { useEffect, useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface KnowledgePoint {
  id: string
  summary: string
  keywords: string[]
  embedding: number[]
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
  const [nodes, setNodes] = useState<KnowledgePointNode[]>([])
  const [selectedNode, setSelectedNode] = useState<KnowledgePointNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Pre-computed similarity matrix for performance
  const [similarityMatrix, setSimilarityMatrix] = useState<number[][]>([])
  const [physicsEnabled, setPhysicsEnabled] = useState(true)

  // Color mapping for different platforms
  const getPlatformColor = (platform: string): string => {
    switch (platform.toLowerCase()) {
      case 'slack': return '#e06c75' // Red
      case 'github': return '#98c379' // Green  
      default: return '#61afef' // Blue
    }
  }

  // Fetch all knowledge points
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

  // Calculate cosine similarity between two embeddings
  const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  // Simple PCA-like dimensionality reduction for positioning
  const reduceEmbeddingsTo2D = (knowledgePoints: KnowledgePoint[]): { x: number; y: number }[] => {
    const positions: { x: number; y: number }[] = []
    
    // Start with random positions
    for (let i = 0; i < knowledgePoints.length; i++) {
      const angle = (i / knowledgePoints.length) * Math.PI * 2
      const distance = 100 + Math.random() * 200
      positions.push({
        x: 400 + Math.cos(angle) * distance,
        y: 300 + Math.sin(angle) * distance
      })
    }

    // Iteratively adjust positions based on embedding similarities
    for (let iteration = 0; iteration < 100; iteration++) {
      for (let i = 0; i < positions.length; i++) {
        let fx = 0, fy = 0
        
        for (let j = 0; j < positions.length; j++) {
          if (i === j) continue
          
          const similarity = cosineSimilarity(knowledgePoints[i].embedding, knowledgePoints[j].embedding)
          const dx = positions[i].x - positions[j].x
          const dy = positions[i].y - positions[j].y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          
          // High similarity = attractive force, low similarity = repulsive force
          const targetDistance = (1 - similarity) * 200 + 50 // 50-250px range
          const force = (distance - targetDistance) * 0.01
          
          fx -= (dx / distance) * force
          fy -= (dy / distance) * force
        }
        
        // Apply force with damping
        positions[i].x += fx * 0.1
        positions[i].y += fy * 0.1
      }
    }

    return positions
  }

  // Pre-compute similarity matrix in chunks to avoid blocking the UI
  const computeSimilarityMatrix = async (knowledgePoints: KnowledgePoint[]): Promise<number[][]> => {
    const matrix: number[][] = []
    const n = knowledgePoints.length
    
    console.log(`Pre-computing ${n}x${n} similarity matrix in chunks...`)
    
    // Initialize matrix
    for (let i = 0; i < n; i++) {
      matrix[i] = new Array(n)
    }
    
    // Compute in chunks to avoid blocking the UI
    const chunkSize = 50 // Process 50 rows at a time
    
    for (let startRow = 0; startRow < n; startRow += chunkSize) {
      const endRow = Math.min(startRow + chunkSize, n)
      
      // Process chunk
      for (let i = startRow; i < endRow; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) {
            matrix[i][j] = 1
          } else if (j < i) {
            matrix[i][j] = matrix[j][i] // Use symmetry
          } else {
            matrix[i][j] = cosineSimilarity(knowledgePoints[i].embedding, knowledgePoints[j].embedding)
          }
        }
      }
      
      // Yield control back to the browser between chunks
      if (endRow < n) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
    
    console.log(`Similarity matrix computed`)
    return matrix
  }

  // Initialize knowledge points with simple positioning (no expensive calculations)
  useEffect(() => {
    const initializeGraph = async () => {
      const knowledgePoints = await fetchKnowledgePoints()
      if (!knowledgePoints.length) return

      console.log(`Loading ${knowledgePoints.length} knowledge points...`)
      
      // Create nodes with simple positioning - no embeddings computation
      const nodes: KnowledgePointNode[] = knowledgePoints.map((kp, index) => {
        const radius = Math.max(12, Math.min(30, kp.summary.length / 15 + kp.qualityScore * 10))
        
        // Simple spiral arrangement
        const angle = (index / knowledgePoints.length) * Math.PI * 2
        const distance = 120 + Math.random() * 180
        
        return {
          ...kp,
          x: 400 + Math.cos(angle) * distance,
          y: 300 + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 1,
          vy: (Math.random() - 0.5) * 1,
          radius,
          color: getPlatformColor(kp.platform)
        }
      })

      // Show nodes immediately
      setNodes(nodes)
      
      // Start computing similarity matrix in background (only if needed for physics)
      setTimeout(async () => {
        setInitializing(true)
        const simMatrix = await computeSimilarityMatrix(knowledgePoints)
        setSimilarityMatrix(simMatrix)
        setInitializing(false)
        console.log(`Similarity matrix ready for physics`)
      }, 1000) // Wait 1 second before starting background computation
    }

    initializeGraph()
  }, [])

  // Optimized physics simulation
  useEffect(() => {
    if (!nodes.length || !physicsEnabled) return
    
    // Use simple physics if similarity matrix isn't ready yet
    const useSimplePhysics = !similarityMatrix.length

    const interval = setInterval(() => {
      setNodes(prevNodes => {
        return prevNodes.map((node, nodeIndex) => {
          let fx = 0, fy = 0

          if (useSimplePhysics) {
            // Simple repulsion-only physics when similarity matrix isn't ready
            prevNodes.forEach((other, otherIndex) => {
              if (nodeIndex === otherIndex) return
              
              const dx = node.x - other.x
              const dy = node.y - other.y
              const distance = Math.sqrt(dx * dx + dy * dy) || 1
              
              // Calculate minimum distance based on both nodes' radii
              const minDistance = node.radius + other.radius + 10
              
              // Simple repulsion within range
              if (distance < 150) {
                const repulsiveForce = (150 - distance) / distance * 0.02
                fx += dx * repulsiveForce
                fy += dy * repulsiveForce
              }
            })
          } else {
            // Use pre-computed similarity matrix for semantic clustering
            prevNodes.forEach((other, otherIndex) => {
              if (nodeIndex === otherIndex) return
              
              const similarity = similarityMatrix[nodeIndex][otherIndex]
              const dx = node.x - other.x
              const dy = node.y - other.y
              const distance = Math.sqrt(dx * dx + dy * dy) || 1
              
              // Calculate minimum distance based on both nodes' radii (collision detection)
              const minDistance = node.radius + other.radius + 10 // Larger buffer to prevent overlap
              
              // Only apply forces to nearby nodes for performance
              if (distance < 400) {
                let targetDistance: number
                
                // If nodes are overlapping, prioritize separation
                if (distance < minDistance) {
                  targetDistance = minDistance
                  // Much stronger repulsive force for overlapping nodes
                  const repulsiveForce = (minDistance - distance) / distance * 0.05
                  fx += dx * repulsiveForce
                  fy += dy * repulsiveForce
                } else {
                  // Normal clustering based on similarity (more spread out)
                  targetDistance = (1 - similarity) * 200 + 60 // 60-260px range (more spread out)
                  const force = (distance - targetDistance) / distance * 0.002 // More responsive force
                  
                  fx -= dx * force
                  fy -= dy * force
                }
              }
            })
          }

          // Very gentle attraction to center to prevent drift
          const centerX = 400
          const centerY = 300
          fx += (centerX - node.x) * 0.00002
          fy += (centerY - node.y) * 0.00002

          // Update velocity with moderate damping for more responsiveness
          const newVx = (node.vx + fx) * 0.88 // Less damping for more responsiveness
          const newVy = (node.vy + fy) * 0.88

          return {
            ...node,
            x: node.x + newVx,
            y: node.y + newVy,
            vx: newVx,
            vy: newVy
          }
        })
      })
    }, 50) // Increased to 20 FPS for more responsiveness

    return () => clearInterval(interval)
  }, [nodes.length, physicsEnabled, similarityMatrix.length])

  // Mouse handlers for panning
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
    }
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
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-background to-secondary border">
      {/* Controls */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-2">
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
        <Button
          size="sm"
          variant={physicsEnabled ? "default" : "outline"}
          onClick={() => setPhysicsEnabled(!physicsEnabled)}
          className="backdrop-blur-sm"
        >
          {physicsEnabled ? "⏸️" : "▶️"}
        </Button>
      </div>

      {/* Graph Container */}
      <div 
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center'
        }}
      >
        {/* Knowledge Point Nodes */}
        {nodes.map(node => (
          <div
            key={node.id}
            className="absolute rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 flex items-center justify-center text-white font-bold text-xs"
            style={{
              left: node.x - node.radius,
              top: node.y - node.radius,
              width: node.radius * 2,
              height: node.radius * 2,
              backgroundColor: node.color,
              boxShadow: `0 0 ${node.radius}px ${node.color}40`
            }}
            onMouseEnter={() => setSelectedNode(node)}
            onMouseLeave={() => setSelectedNode(null)}
          >
            {node.platform.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>

      {/* Info Panel */}
      {selectedNode && (
        <div className="absolute top-3 right-3 z-30">
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
      <div className="absolute bottom-3 right-3 text-xs text-muted-foreground z-30">
        {nodes.length} knowledge points
        {initializing && (
          <div className="flex items-center gap-1 mt-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Computing clusters...</span>
          </div>
        )}
      </div>
    </div>
  )
}