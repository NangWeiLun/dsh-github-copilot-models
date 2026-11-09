/**
 * The part of a Cordis `Context` (`@deepseek-ai/cordis` 4.0.5) the Host uses.
 * Declared locally so the plugin needs no `@deepseek-ai/cordis` dependency:
 * DSH supplies the Context at runtime.
 */

/** A disposer an effect returns. */
type Disposer = () => void | Promise<void>

export interface HostLogger {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export interface HostContext {
  /** Look a service up by name; undefined while it is not mounted. */
  get(name: string): unknown
  /** Register a cleanup-aware effect on this context. */
  effect(execute: () => Disposer, label?: string): unknown
  /** Listen to an event; removed when this context is disposed. */
  on(name: string, listener: (...args: never[]) => unknown): unknown
  /** Run `callback` in a child context while every named service is mounted. */
  inject(deps: readonly string[], callback: (ctx: HostContext) => void): unknown
  readonly logger: HostLogger
  /** This plugin instance's fiber; its entry carries the profile row id. */
  readonly fiber: { readonly entry?: { readonly options: { readonly id?: string } } }
}
