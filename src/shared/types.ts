export interface Position2D { x: number; y: number }
export interface SimConfig { seed: number; durationSeconds: number }
export interface WorldObject { id: string; position: Position2D; velocity: Position2D; thermalIntensity: number }
export interface WorldFrame { timeSeconds: number; objects: WorldObject[] }
export interface SensorObservation { id: string; sensorId: string; observedAtSeconds: number; receivedAtSeconds: number; position: Position2D; quality: number }
export interface SensorFrame { sensorId: string; timeSeconds: number; observations: SensorObservation[]; available: boolean }
export interface ThermalFrame { timeSeconds: number; width: number; height: number; pixels: number[]; available: boolean }
export interface SimulationEvent { timeSeconds: number; severity: 'info' | 'warning'; source: string; message: string }
