/*
 * Minimal ambient WebGPU surface for the Catchment M0 spike.
 * We intentionally avoid a hard dependency on `@webgpu/types` for now so the
 * project stays installable/type-checkable without extra packages. Every GPU
 * handle is treated as `any` here; swap this file for `@webgpu/types` (added to
 * devDependencies) when we want full typing in a later milestone.
 */

interface Navigator {
  readonly gpu?: any;
}
interface WorkerNavigator {
  readonly gpu?: any;
}

declare const GPUBufferUsage: any;
declare const GPUTextureUsage: any;
declare const GPUShaderStage: any;
declare const GPUMapMode: any;
declare const GPUColorWrite: any;
