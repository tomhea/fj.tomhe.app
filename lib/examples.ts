export interface Example {
  name: string;
  description: string;
  files: Array<{ name: string; content: string }>;
}

export const EXAMPLES: Example[] = [
  {
    name: 'Hello World',
    description: 'Print "Hello, World!" to the terminal.',
    files: [
      {
        name: 'hello.fj',
        content: `// FlipJump Hello World
// The language has a single instruction: f;j
//   - Flip the bit at address f
//   - Then jump to address j
// stl.* macros come from the FlipJump standard library.

stl.startup

stl.output_char 'H'
stl.output_char 'e'
stl.output_char 'l'
stl.output_char 'l'
stl.output_char 'o'
stl.output_char ','
stl.output_char ' '
stl.output_char 'W'
stl.output_char 'o'
stl.output_char 'r'
stl.output_char 'l'
stl.output_char 'd'
stl.output_char '!'
stl.output_char 10        // newline
stl.loop                  // halt (loop to self)
`,
      },
    ],
  },
  {
    name: 'Counter (0–9)',
    description: 'Count from 0 to 9 and print each digit.',
    files: [
      {
        name: 'counter.fj',
        content: `// Count from 0 to 9.

stl.startup

stl.output_char '0'
stl.output_char '1'
stl.output_char '2'
stl.output_char '3'
stl.output_char '4'
stl.output_char '5'
stl.output_char '6'
stl.output_char '7'
stl.output_char '8'
stl.output_char '9'
stl.output_char 10
stl.loop
`,
      },
    ],
  },
  {
    name: 'Alphabet',
    description: 'Print the lowercase alphabet a–z.',
    files: [
      {
        name: 'alphabet.fj',
        content: `// Print the lowercase alphabet a-z.

stl.startup

stl.output_char 'a'
stl.output_char 'b'
stl.output_char 'c'
stl.output_char 'd'
stl.output_char 'e'
stl.output_char 'f'
stl.output_char 'g'
stl.output_char 'h'
stl.output_char 'i'
stl.output_char 'j'
stl.output_char 'k'
stl.output_char 'l'
stl.output_char 'm'
stl.output_char 'n'
stl.output_char 'o'
stl.output_char 'p'
stl.output_char 'q'
stl.output_char 'r'
stl.output_char 's'
stl.output_char 't'
stl.output_char 'u'
stl.output_char 'v'
stl.output_char 'w'
stl.output_char 'x'
stl.output_char 'y'
stl.output_char 'z'
stl.output_char 10
stl.loop
`,
      },
    ],
  },
  {
    name: 'Multi-file',
    description: 'Two-file project: a macro library and a main file.',
    files: [
      {
        name: 'greet.fj',
        content: `// Greeting macro library.

ns greet {
    def say_hi {
        stl.output "Hello from greet"
        stl.output_char 10
    }
}
`,
      },
      {
        name: 'main.fj',
        content: `// Multi-file example — compiled together with greet.fj.

stl.startup

greet.say_hi
stl.loop
`,
      },
    ],
  },
  {
    name: 'Hex Digits',
    description: 'Print the hexadecimal digits 0–9 A–F.',
    files: [
      {
        name: 'hexdigits.fj',
        content: `// Print hex digits: 0-9 A-F.

stl.startup

stl.output_char '0'
stl.output_char '1'
stl.output_char '2'
stl.output_char '3'
stl.output_char '4'
stl.output_char '5'
stl.output_char '6'
stl.output_char '7'
stl.output_char '8'
stl.output_char '9'
stl.output_char 'A'
stl.output_char 'B'
stl.output_char 'C'
stl.output_char 'D'
stl.output_char 'E'
stl.output_char 'F'
stl.output_char 10
stl.loop
`,
      },
    ],
  },
];
