// howler 는 의존성에 추가되어 있지 않을 수 있다.
// (CLAUDE.md 의 "package.json 직접 수정 금지" 규칙 — 사용자가 직접 설치)
//
// 런타임에서는 SoundManager 가 동적 import 로 howler 를 로드하고,
// 모듈 로드 실패 시 native HTMLAudioElement 로 폴백한다.
// 타입 컴파일이 깨지지 않도록 최소 형태만 선언해두는 shim.
declare module 'howler' {
  export interface HowlOptions {
    src: string[]
    volume?: number
    preload?: boolean
    html5?: boolean
    onloaderror?: (id: number, error: unknown) => void
    onplayerror?: (id: number, error: unknown) => void
  }

  export class Howl {
    constructor(options: HowlOptions)
    play(): number
    stop(id?: number): this
    unload(): void
    volume(value?: number): number | this
    state(): 'unloaded' | 'loading' | 'loaded'
    on(event: string, fn: (...args: unknown[]) => void): this
    off(event: string, fn?: (...args: unknown[]) => void): this
  }

  export class Howler {
    static volume(value?: number): number
    static mute(muted?: boolean): boolean
    static unload(): void
  }
}
