export interface FJFile {
  id: string;
  name: string;
  content: string;
}

export interface SourceFile {
  name: string;
  type: 'bf' | 'c';
  content: string;
  /**
   * For type 'c' only: the FJ code produced by c2fj.
   * Stored here (not in the editor) so that large generated files do not
   * freeze Monaco.  Toolbar exposes a "Run C Output" button when this is set.
   */
  fjOutput?: string;
}

export interface MonacoMarker {
  filename: string;
  startLine: number;
  startCol: number;
  endLine?: number;
  endCol?: number;
  message: string;
}

export interface TerminalLine {
  type: 'stdout' | 'stderr' | 'info' | 'error';
  text: string;
  id: number;
  /** True while this line is still receiving chunks (no \n yet). */
  partial?: boolean;
}

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error';
export type RunStatus = 'idle' | 'running' | 'exited' | 'error';

// WebSocket message types (client → server)
export interface WsRunFj {
  type: 'run_fj';
  files: Array<{ name: string; content: string }>;
}

export interface WsRunFjm {
  type: 'run_fjm';
  fjmBase64: string;
}

export interface WsStdin {
  type: 'stdin';
  stdin: string;
}

export interface WsKill {
  type: 'kill';
}

export type ClientMessage = WsRunFj | WsRunFjm | WsStdin | WsKill;

// WebSocket message types (server → client)
export interface WsStdout {
  type: 'stdout';
  data: string;
}

export interface WsStderr {
  type: 'stderr';
  data: string;
}

export interface WsStarted {
  type: 'started';
}

export interface WsExit {
  type: 'exit';
  code: number | null;
  signal?: string | null;
}

export interface WsError {
  type: 'error';
  data: string;
}

export type ServerMessage = WsStdout | WsStderr | WsStarted | WsExit | WsError;
