export interface Example {
  name: string;
  description: string;
  files: Array<{ name: string; content: string }>;
}

export const EXAMPLES: Example[] = [
  {
    name: 'Hello World',
    description: 'Print "Hello, World!" to the terminal.',
    files: [{
      name: 'hello.fj',
      content: `; FlipJump Hello World
; The FlipJump language has a single instruction: f;j
;   - Flip the bit at address f
;   - Then jump to address j
;
; This example uses standard library macros.

.startup main

main:
    output 'H'
    output 'e'
    output 'l'
    output 'l'
    output 'o'
    output ','
    output ' '
    output 'W'
    output 'o'
    output 'r'
    output 'l'
    output 'd'
    output '!'
    output '\\n'
    halt
`,
    }],
  },
  {
    name: 'Counter (0–9)',
    description: 'Count from 0 to 9 and print each digit.',
    files: [{
      name: 'counter.fj',
      content: `; Count from 0 to 9

.startup main

main:
    output '0'
    output '1'
    output '2'
    output '3'
    output '4'
    output '5'
    output '6'
    output '7'
    output '8'
    output '9'
    output '\\n'
    halt
`,
    }],
  },
  {
    name: 'Alphabet',
    description: 'Print the lowercase alphabet a–z.',
    files: [{
      name: 'alphabet.fj',
      content: `; Print the lowercase alphabet a-z

.startup main

main:
    output 'a'
    output 'b'
    output 'c'
    output 'd'
    output 'e'
    output 'f'
    output 'g'
    output 'h'
    output 'i'
    output 'j'
    output 'k'
    output 'l'
    output 'm'
    output 'n'
    output 'o'
    output 'p'
    output 'q'
    output 'r'
    output 's'
    output 't'
    output 'u'
    output 'v'
    output 'w'
    output 'x'
    output 'y'
    output 'z'
    output '\\n'
    halt
`,
    }],
  },
  {
    name: 'Multi-file',
    description: 'Two-file project: a macro library and a main file.',
    files: [
      {
        name: 'greet.fj',
        content: `; Greeting macro library

ns greet

def say_hi:
    output 'H'
    output 'i'
    output '!'
    output '\\n'

ns
`,
      },
      {
        name: 'main.fj',
        content: `; Multi-file example — compiled together with greet.fj

.startup main

main:
    greet.say_hi
    halt
`,
      },
    ],
  },
  {
    name: 'Hex Digits',
    description: 'Print the hexadecimal digits 0–9 A–F.',
    files: [{
      name: 'hexdigits.fj',
      content: `; Print hex digits: 0-9 A-F

.startup main

main:
    output '0'
    output '1'
    output '2'
    output '3'
    output '4'
    output '5'
    output '6'
    output '7'
    output '8'
    output '9'
    output 'A'
    output 'B'
    output 'C'
    output 'D'
    output 'E'
    output 'F'
    output '\\n'
    halt
`,
    }],
  },
];
