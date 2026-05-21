export interface Example {
  name: string;
  description: string;
  files: Array<{ name: string; content: string }>;
}

export const EXAMPLES: Example[] = [
  // ── 1. Hello World ───────────────────────────────────────────────────────
  {
    name: 'Hello World',
    description: 'The three-line FlipJump program — startup, print a greeting, halt.',
    files: [
      {
        name: 'hello.fj',
        content: `// Hello World in FlipJump
// All programs start with stl.startup, which initialises the runtime.
// stl.output writes a constant string of bytes to stdout.
// stl.loop halts the program by jumping to itself forever.

// Ctrl+Click on a macro (such as "output"), to see its implementation.

// View more examples in the Examples menu above.


stl.startup
stl.output "Hello, World!\\n(:"
stl.loop
`,
      },
    ],
  },

  // ── 2. Add Two Numbers ────────────────────────────────────────────────────
  {
    name: 'Add Two Numbers',
    description: 'bit.add two 8-bit values; the sum is printed as an ASCII character.',
    files: [
      {
        name: 'add.fj',
        content: `// Add two 8-bit integers and print the result as an ASCII character.
//
// bit.vec 8, '5'   declares an 8-bit variable initialised to ASCII '5' (= 53).
// bit.add 8, a, b  computes  a <- a + b  in 8-bit arithmetic.
// bit.print a      outputs the byte stored in a as a character.
//
// Current result: '5' (53) + 2 = 55  ->  prints '7'
// Try changing the initial values of a and b!

stl.startup
bit.add 8, a, b
bit.print a
stl.loop

a:
  bit.vec 8, '5'    // initial value: ASCII code for '5'
b:
  bit.vec 8, 0x02   // add 2
`,
      },
    ],
  },

  // ── 3. Compare Numbers ────────────────────────────────────────────────────
  {
    name: 'Compare Numbers',
    description: 'bit.cmp two n-bit integers and branch on less-than / equal / greater-than.',
    files: [
      {
        name: 'cmp.fj',
        content: `// Compare two n-bit integers with bit.cmp.
// bit.cmp n, a, b, lt, eq, gt  jumps to lt / eq / gt depending on a vs b.
//
// Try changing a, b, or the word size n!
// Current: a=3, b=1, n=4  ->  prints '>'

stl.startup

n=4
bit.cmp n, a, b, lt, eq, gt

lt:
    stl.output '<'
    stl.loop
eq:
    stl.output '='
    stl.loop
gt:
    stl.output '>'
    stl.loop

a:
    bit.vec n, 3
b:
    bit.vec n, 1
`,
      },
    ],
  },

  // ── 4. Hex Addition ───────────────────────────────────────────────────────
  {
    name: 'Hex Addition',
    description: 'Add two 4-bit hex values and display the single hex-digit result.',
    files: [
      {
        name: 'hexadd.fj',
        content: `// Add two 4-bit hex values and print the result as a hex digit.
//
// bit.add 4, a, b     computes a <- a + b  (one hex digit wide).
// bit.hex2ascii c, a  converts the 4-bit value in a to an ASCII hex digit in c.
// bit.print c         outputs the character.
//
// Current: 0x5 + 0x7 = 0xC  ->  prints 'C'
// Change a and b (values 0-15) to experiment.

stl.startup
bit.add 4, a, b
bit.hex2ascii c, a
bit.print c
stl.loop

a:
    bit.vec 4, 0x5
b:
    bit.vec 4, 0x7
c:
    bit.vec 8        // storage for the ASCII result
`,
      },
    ],
  },

  // ── 5. Function Calls ─────────────────────────────────────────────────────
  {
    name: 'Function Calls',
    description: 'Define and call a parameterless function with stl.call / stl.return.',
    files: [
      {
        name: 'func.fj',
        content: `// Demonstrates parameterless function calls.
//
// stl.startup_and_init_all N  boots the runtime with a call-stack depth of N.
// stl.call label              calls a function (saves the return address).
// stl.return                  returns to the caller.
//
// Prints "ABC\\n" — the 'B' is printed inside func1.

stl.startup_and_init_all 10

test1:
    stl.output 'A'
    stl.call func1
    stl.output 'C'
    stl.output '\\n'
    stl.loop

func1:
    stl.output 'B'
    stl.return
`,
      },
    ],
  },

  // ── 6. Echo Stdin ─────────────────────────────────────────────────────────
  {
    name: 'Echo Stdin',
    description: 'Read characters from stdin and echo them — a cat(1) in FlipJump.',
    files: [
      {
        name: 'cat.fj',
        content: `// Echo every character from stdin back to stdout.
// Stops on EOF (null byte) or a newline / carriage-return.
//
// Use the "Initial stdin" box in the toolbar to provide input,
// then click Run FJ.
//
// bit.input ascii    reads one byte from stdin into the variable.
// bit.if0 8, v, lbl  jumps to lbl when all 8 bits of v are zero (EOF).
// bit.cmp            compares the byte to newline/CR.

stl.startup
start:
    bit.input ascii
    bit.if0 8, ascii, end
    bit.cmp 8, ascii, nl, final_check, end, final_check
  final_check:
    bit.cmp 8, ascii, cr, print, end, print
print:
    bit.print ascii
    ;start
end:
    stl.loop

ascii:
    bit.vec 8, 0
nl:
    bit.vec 8, '\\n'
cr:
    bit.vec 8, '\\r'
`,
      },
    ],
  },

  // ── 7. Print Signed Integers ──────────────────────────────────────────────
  {
    name: 'Print Signed Integers',
    description: 'Print three signed integers in decimal form using bit.print_dec_int.',
    files: [
      {
        name: 'print_dec.fj',
        content: `// Print three signed word-width integers in decimal, each on its own line.
//
// stl.fcall / stl.fret are the low-level function-call primitives.
// bit.print_dec_int w, val  prints the word-wide variable as a signed decimal.
//
// Outputs:
//   123456
//   0
//   -123456
//
// Change v1, v2, v3 to print your own numbers.
// Note: 0-123456 is the FlipJump idiom for the negative literal -123456.

stl.startup

print_int v1
print_int v2
print_int v3
stl.loop


v1: bit.vec w, 123456
v2: bit.vec w, 0
v3: bit.vec w, 0-123456
ret_reg: 0;0

def print_int v < ret_reg, val, print_int {
    bit.mov w, val, v
    stl.fcall print_int, ret_reg
}

print_int:
    bit.print_dec_int w, val
    stl.output '\\n'
    stl.fret ret_reg
    val: bit.vec w
`,
      },
    ],
  },

  // ── 9. Prime Sieve ────────────────────────────────────────────────────────
  {
    name: 'Prime Sieve',
    description: 'Find primes up to 30 with trial division — loops, comparison, and division.',
    files: [
      {
        name: 'prime_sieve.fj',
        content: `// Print all prime numbers from 2 to 30 using trial division.
//
// For each candidate n in [2, LIMIT]:
//   For each divisor d in [2, n-1]:
//     if n mod d == 0 → composite, skip to next n
//   If no divisor found → prime, print n
//
// Uses bit.idiv_loop to compute the remainder of n/d.
// Expected output: 2 3 5 7 11 13 17 19 23 29

LIMIT = 30

stl.startup

n_loop:
    // if n > LIMIT → done; otherwise check if n is prime
    bit.cmp w, n, limit_val, check_n_prime, check_n_prime, print_newline
check_n_prime:
    // Reset: d = 2
    bit.mov w, d, two

    d_loop:
        // if d >= n → no divisor found → n is prime
        bit.cmp w, d, n, test_divisor, n_is_prime, n_is_prime
    test_divisor:
        // tmp_n = n  (idiv_loop destroys its first argument)
        bit.mov w, tmp_n, n
        bit.idiv_loop w, tmp_n, d, quot, rem
        // if rem == 0 → composite
        bit.if0 w, rem, n_is_composite
        // d += 1, continue inner loop
        bit.add w, d, one
        ;d_loop

    n_is_prime:
        bit.print_dec_int w, n
        stl.output_char ' '
        ;n_next
    n_is_composite:
        ;n_next
    n_next:
        bit.add w, n, one
        ;n_loop

print_newline:
    stl.output_char '\\n'
    stl.loop

// Variables
n:          bit.vec w, 2      // current candidate (starts at 2)
d:          bit.vec w, 0
tmp_n:      bit.vec w, 0
quot:       bit.vec w, 0
rem:        bit.vec w, 0
two:        bit.vec w, 2
limit_val:  bit.vec w, LIMIT
`,
      },
    ],
  },

  // ── 10. Multi-file Compilation ────────────────────────────────────────────
  {
    name: 'Multi-file Compilation',
    description: 'Two-file project: a library defines a macro used by the main file.',
    files: [
      {
        name: 'greet.fj',
        content: `// greet.fj — a tiny library that defines the greet macro.
//
// This file is compiled BEFORE main.fj (it is listed first in the Explorer).
// main.fj can therefore call greet because it is defined in an earlier file.

ns mylib {
    def greet name_str {
        stl.output "Hello, "
        stl.output name_str
        stl.output "!\\n"
    }
}
`,
      },
      {
        name: 'main.fj',
        content: `// main.fj — entry point; uses mylib.greet from greet.fj.
//
// Multi-file compilation: all .fj files are assembled together in the order
// shown in the Explorer sidebar.  Macros in earlier files are available here.
//
// Try dragging greet.fj below main.fj — the compile will fail because
// mylib.greet is no longer defined before it is called.

stl.startup

mylib.greet "World"
mylib.greet "FlipJump"

stl.loop
`,
      },
    ],
  },

  // ── 8. Calculator ─────────────────────────────────────────────────────────
  {
    name: 'Calculator',
    description: 'Interactive calculator — enter "5 + 3" or "0xa * 0xb". Supports +, -, *, /, %.',
    files: [
      {
        name: 'calc.fj',
        content: `// Interactive calculator — supports +, -, *, /, %, ^ (repeat-multiply).
// Accepts both decimal and hexadecimal (prefix with x or X) input.
//
// Usage: enter two numbers with an operator between them, then press Enter.
//   5 + 3       -> 8
//   0xa * 0xb   -> 110  (hex output since hex input was used)
//   10 / 3      -> 3
//   10 % 3      -> 1
// Type q or Q to quit.
//
// Tip: put "5 + 3\\n" in the "Initial stdin" box before running.

stl.startup


loop:
    bit.zero hex_used
    bit.print 3, prompt_string
    getch
    remove_spaces
    check_quit should_quit, before_start
  should_quit:
    getch
    remove_spaces
    line_ended finish, finish, err_loop
  before_start:
    line_ended loop, finish, start

  start:
    insert_number a

    remove_spaces
    bit.mov 8, op, ascii
    line_ended do_print, do_print, advance
  advance:
    getch

    remove_spaces
    insert_number b

    remove_spaces

    bit.zero should_finish
    line_ended do_calc, mark_finish, err_loop
  mark_finish:
    bit.not should_finish
  do_calc:
    calc a, op, b
    bit.if1 error, err_loop


  do_print:
    print_int a
    stl.output '\\n'

    bit.if should_finish, loop, finish

  err_getch:
    getch
  err_loop:
    line_ended print_err, print_err, err_getch
  print_err:
    bit.print 7, err_string
    line_ended loop, finish, finish

  finish:
    stl.loop



def remove_spaces @ main_loop, try2, next_ascii, end < space1, space2, ascii {
  main_loop:
    bit.cmp 8, ascii, space1, try2, next_ascii, try2
  try2:
    bit.cmp 8, ascii, space2, end, next_ascii, end
  next_ascii:
    getch
    ;main_loop

  end:
}



def insert_number x @ \\
        check1, set_minus, check2, before_hex, hex_loop, before_dec, dec_loop, minus_flag, end, after_minus \\
        < dec, hex_prefix1, hex_prefix2, t, hex, minus, ascii, error, hex_used {
    bit.zero w, x
    bit.zero minus_flag
    bit.cmp 8, ascii, minus, check1, set_minus, check1
  set_minus:
    getch
    bit.not minus_flag
  check1:
    bit.cmp 8, ascii, hex_prefix1, check2,     before_hex, check2
  check2:
    bit.cmp 8, ascii, hex_prefix2, before_dec, before_hex, before_dec

  before_hex:
    getch
    bit.one hex_used
  hex_loop:
    bit.ascii2hex error, hex, ascii
    bit.if1 error, end
    bit.shl w, 4, x
    bit.xor 4, x, hex
    getch
    ;hex_loop

  before_dec:
    bit.zero w-4, t+4*dw
  dec_loop:
    bit.ascii2dec error, dec, ascii
    bit.if1 error, end
    bit.mov 4, t, dec
    bit.mul10 w, x
    bit.add w, x, t
    getch
    ;dec_loop

  minus_flag:
    bit.bit
  end:
    bit.if0 minus_flag, after_minus
    bit.neg w, x
  after_minus:
    bit.zero error
}



def calc a, op, b @ try_add, try_sub, try_mul, try_mul_loop, try_div, try_mod, \\
        add, sub, mul, mul_loop, div_mod, div, mod, bad, div_mod_flag, r, q, end \\
        < minus, asterisk, error, percentage, roof, slash, plus {
    bit.zero error

  try_add:
    bit.cmp 8, op, plus,     try_sub,      add, try_sub
  try_sub:
    bit.cmp 8, op, minus,    try_mul,      sub, try_mul
  try_mul:
    bit.cmp 8, op, asterisk, try_mul_loop, mul, try_mul_loop
  try_mul_loop:
    bit.cmp 8, op, roof,     try_div, mul_loop, try_div
  try_div:
    bit.zero div_mod_flag
    bit.cmp 8, op, slash,    try_mod, div_mod,  try_mod
  try_mod:
    bit.not div_mod_flag
    bit.cmp 8, op, percentage, bad,   div_mod,   bad
  add:
    bit.add w, a, b
    ;end
  sub:
    bit.sub w, a, b
    ;end
  mul:
//    bit.mul w, a, b
//    ;end
  mul_loop:
    bit.mul_loop w, a, b
    ;end
  div_mod:
//    bit.idiv w, a, b, q, r
    bit.idiv_loop w, a, b, q, r
    bit.if div_mod_flag, div, mod
  div:
    bit.mov w, a, q
    ;end
  mod:
    bit.mov w, a, r
    ;end
  bad:
    bit.one error
    ;end

  div_mod_flag:
    bit.bit
  r:
    bit.vec w
  q:
    bit.vec w
  end:
}



def line_ended true, end, false @ try_end_line_n < end_line_r, end_line_n, ascii {
    bit.if0 8, ascii, end
    bit.cmp 8, ascii, end_line_r, try_end_line_n, true, try_end_line_n
  try_end_line_n:
    bit.cmp 8, ascii, end_line_n, false, true, false
}



def check_quit true, false @ try_quit1 < ascii, quit1, quit2 {
    bit.cmp 8, ascii, quit2, try_quit1, true, false
  try_quit1:
    bit.cmp 8, ascii, quit1, false,     true, false
}



// does not echo input characters
def getch < ascii {
    bit.input ascii
}



def print_int x @ print_hex, end < hex_used {
    bit.if1 hex_used, print_hex
    bit.print_dec_int w, x
    ;end
  print_hex:
    bit.print_hex_int w, x, 1
  end:
}



op:     bit.vec 8, 0
ascii:  bit.vec 8, 0
error:  bit.bit 0
hex:    bit.vec 4, 0
dec:    bit.vec 4, 0
should_finish:  bit.bit 0
hex_used:       bit.bit 0

a:  bit.vec w, 0
b:  bit.vec w, 0
t:  bit.vec w, 0

plus:   bit.vec 8, '+'
minus:  bit.vec 8, '-'
asterisk:   bit.vec 8, '*'
roof:   bit.vec 8, '^'
slash:  bit.vec 8, '/'
percentage: bit.vec 8, '%'

hex_prefix1:bit.vec 8, 'x'
hex_prefix2:bit.vec 8, 'X'

eof:        bit.vec 8, '\\0'
end_line_r: bit.vec 8, '\\r'
end_line_n: bit.vec 8, '\\n'
space1:     bit.vec 8, ' '
space2:     bit.vec 8, '\\t'

quit1:     bit.vec 8, 'Q'
quit2:     bit.vec 8, 'q'


err_string:     bit.str "Error!\\n"
prompt_string:  bit.str ">  "
`,
      },
    ],
  },
];
