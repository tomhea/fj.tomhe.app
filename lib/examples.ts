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

  // ── 9. Prime Sieve ────────────────────────────────────────────────────────
  {
    name: 'Prime Sieve',
    description: 'Find primes up to a given input.',
    files: [
      {
        name: 'prime_sieve.fj',
        content: `// This fj program prints all the prime numbers (as decimal numbers) up to a number n (given by input).


// Constants:

hw = w/4
PRIMES_MEMORY_START = (1 << (w-1))   // 1/2 of the memory
PRIMES_MEMORY_LENGTH = (1 << (w-1))  // 1/2 of the memory
FIRST_PRIME = 5
MAX_PRIMES = PRIMES_MEMORY_LENGTH / dw
NUMBER_OF_PRIMES_MESSAGE = "Number of prime numbers: "


// The Program:

prime_sieve_main

segment PRIMES_MEMORY_START
    reserve PRIMES_MEMORY_LENGTH  // This is the prime sieve table - it is initialized (reserved) with zeros.


// Macro definitions:


// The main macro. Ask for an input N, and then prints all primes from 0 to N, and the number of primes found.
//  This program runs the prime-sieve algorithm, and only checks (and marks) the 6k+-1 primes.
def prime_sieve_main @ prime_loop_if, prime_loop, next_prime, end, \
        n, primes_ptr_n, p, primes_ptr, mark_primes_ptr, p_2dw_offset, p_4dw_offset, num_of_primes, is_add_4 {
    stl.startup_and_init_all
    input_max_prime n, primes_ptr_n
    handle_small_n n

  prime_loop_if:  // for each p=6k+-1 upto n:
    hex.cmp hw, p, n, prime_loop, prime_loop, end
  prime_loop:
    if1_ptr primes_ptr, next_prime
  // if p is prime:
    print_int hw, p  // TODO #196 - save ton of times by declaring p "dec", with dec.vec, dec.set, dec.add and dec.print
    hex.inc hw, num_of_primes
    mark_primes mark_primes_ptr, primes_ptr_n, is_add_4, p_2dw_offset, p_4dw_offset
  next_prime:
    set_full_next_prime p, primes_ptr, mark_primes_ptr, p_2dw_offset, p_4dw_offset, is_add_4
    is_add_4+dbit; prime_loop_if

  end:
    stl.output NUMBER_OF_PRIMES_MESSAGE
    print_int hw, num_of_primes
    stl.loop


// Variables:

  n: hex.vec hw
  primes_ptr_n: hex.vec hw, PRIMES_MEMORY_START

  p: hex.vec hw, FIRST_PRIME
  primes_ptr: hex.vec hw, PRIMES_MEMORY_START + FIRST_PRIME * dw
  mark_primes_ptr: hex.vec hw, PRIMES_MEMORY_START + FIRST_PRIME*FIRST_PRIME * dw

  p_2dw_offset: hex.vec hw, FIRST_PRIME * 2 * dw
  p_4dw_offset: hex.vec hw, FIRST_PRIME * 4 * dw

  num_of_primes: hex.vec hw, 2  // The number of primes smaller than FIRST_PRIME

  is_add_4: bit.bit (FIRST_PRIME % 6) == 1  // if 0: add 2 to p, else: add 4.
}


// Time Complexity: marks * w(9.25@+7)
//   Mark all primes from p*p upto n.
// mark_primes_ptr expected to point to p*p, primes_ptr_n to n, and p_dw_offset is p*dw.
def mark_primes mark_primes_ptr, primes_ptr_n, p_is_add_4, p_2dw_offset, p_4dw_offset \
        @ mark_loop_if, mark_loop, next_prime, curr_prime_ptr, is_add_4, ONE, end {
    hex.mov hw, curr_prime_ptr, mark_primes_ptr
    bit.mov is_add_4, p_is_add_4

  mark_loop_if:
    hex.cmp hw, curr_prime_ptr, primes_ptr_n, mark_loop, mark_loop, end
  mark_loop:
    if1_ptr curr_prime_ptr, next_prime
    hex.xor_hex_to_ptr curr_prime_ptr, ONE
  next_prime:
    advance_ptr_by_p_Xdw curr_prime_ptr, p_2dw_offset, p_4dw_offset, is_add_4
    is_add_4+dbit; mark_loop_if

  curr_prime_ptr: hex.vec hw
  is_add_4: bit.bit
  ONE: hex.hex 1

  end:
}


// if n < 2, print nothing and exit. if n == 2 print 2 and exit. else, print 2,3 and continue.
def handle_small_n n @ less_than_2, equals_2, print_2_3_then_start, TWO, continue_address {
    hex.cmp hw, n, TWO, less_than_2, equals_2, print_2_3_then_start

  less_than_2:
    stl.output NUMBER_OF_PRIMES_MESSAGE
    stl.output "0\\n"
    stl.loop

  equals_2:
    stl.output "2\\n"
    stl.output NUMBER_OF_PRIMES_MESSAGE
    stl.output "1\\n"
    stl.loop

  print_2_3_then_start:
    stl.output "2\\n3\\n"
    ;continue_address

  TWO: hex.vec hw, 2

  continue_address:
}


// Time Complexity: w(@+3) + @+3
//   primes_ptr += 2p*dw / 4p*dw (depends on the is_add_4 flag).
def advance_ptr_by_p_Xdw primes_ptr, p_2dw_offset, p_4dw_offset, is_add_4 @ p_add_2, p_add_4, end {
    bit.if is_add_4, p_add_2, p_add_4
  p_add_2:
    hex.add hw, primes_ptr, p_2dw_offset
    ;end
  p_add_4:
    hex.add hw, primes_ptr, p_4dw_offset
  end:
}


// Time Complexity: w(5.5@) + 42@+71
//   Update all the prime variables and pointers by 2/4, depends on the is_add_4 flag:
//     p += 2/4.
//     primes_ptr += 2/4 * dw.
//     p_2dw_offset += 2/4 * 2dw.
//     p_4dw_offset += 2/4 * 4dw.
//     update the mark_primes_ptr (will point to the new p*p)
def set_full_next_prime p, primes_ptr, mark_primes_ptr, p_2dw_offset, p_4dw_offset, is_add_4 @ p_add_2, p_add_4, end {
    bit.if is_add_4, p_add_2, p_add_4
  p_add_2:
    _set_next_prime_mark_ptr mark_primes_ptr, p, 0, 2+#w
    hex.add_constant hw, primes_ptr, 2 * dw
    hex.add_constant hw, p_2dw_offset, 2 * 2 * dw
    hex.add_constant hw, p_4dw_offset, 2 * 4 * dw
    hex.add_constant hw, p, 2
    ;end
  p_add_4:
    _set_next_prime_mark_ptr mark_primes_ptr, p, 1, 3+#w
    hex.add_constant hw, primes_ptr, 4 * dw
    hex.add_constant hw, p_2dw_offset, 4 * 2 * dw
    hex.add_constant hw, p_4dw_offset, 4 * 4 * dw
    hex.add_constant hw, p, 4
  end:
}


// Time Complexity: w(5.5@) + 6@+15
// Advances mark_primes_ptr to point to the current PRIMES_MEMORY_START + p*p * dw.
//   if is_add_2:  mark_primes_ptr += ((p+2)^2 - p^2) * dw
//   if is_add_4:  mark_primes_ptr += ((p+4)^2 - p^2) * dw
def set_next_prime_mark_ptr mark_primes_ptr, p, is_add_4 @ p_add_2, p_add_4, end {
    bit.if is_add_4, p_add_2, p_add_4
  p_add_2:
    _set_next_prime_mark_ptr mark_primes_ptr, p, 0, 2+#w
    ;end
  p_add_4:
    _set_next_prime_mark_ptr mark_primes_ptr, p, 1, 3+#w
  end:
}
// Time Complexity: w(5.5@) + 5@+12
// Advances mark_primes_ptr to point to the current PRIMES_MEMORY_START + p*p * dw  (basically adds dw times 4p+4 / 8p+16, based on is_add_4).
//   for p_add_2 call with (p,0,2+#w), for p_add_4 call with (p,1,3+#w)
def _set_next_prime_mark_ptr mark_primes_ptr, p, inc_offset, shift_size @ bit_p, p_squared_diff, end {
    stl.hex2bit hw, bit_p, p
    bit.inc w-inc_offset, bit_p + dw*inc_offset
    bit.shl w, shift_size, bit_p
    stl.bit2hex w, p_squared_diff, bit_p
    hex.add hw, mark_primes_ptr, p_squared_diff
    ;end

  bit_p: bit.vec w
  p_squared_diff: hex.vec dw

  end:
}


// print hex[:n] as a decimal integer.
def print_int n, hex @ bit, end{
    stl.hex2bit n, bit, hex
    bit.print_dec_int 4*n, bit
    stl.output '\\n'
    ;end

  bit: bit.vec 4*n

  end:
}


// if *hex_ptr != 0 goto l1.
def if1_ptr hex_ptr, l1 @ l0 {
    if_ptr hex_ptr, l0, l1
  l0:
}


// if *hex_ptr == 0 goto l0, else goto l1.
def if_ptr hex_ptr, l0, l1 @ ptr_value {
    hex.zero ptr_value
    hex.xor_hex_from_ptr ptr_value, hex_ptr
    hex.if ptr_value, l0, l1

  ptr_value: hex.hex
}


// primes_ptr = PRIMES_MEMORY_START + p*dw
def set_primes_ptr primes_ptr, p @ p_offset, end {
    hex.set hw, primes_ptr, PRIMES_MEMORY_START
    hex.mov hw, p_offset, p
    shl_hex hw, p_offset, #w
    hex.add hw, primes_ptr, p_offset
    ;end

  p_offset: hex.vec hw

  end:
}


// hex[:n] <<= shift
def shl_hex n, hex, shift {
    rep(shift/4, i) hex.shl_hex n, hex
    rep(shift%4, i) hex.shl_bit n, hex
}


// n = input_decimal_number(). check that n is smaller than MAX_PRIMES.
// primes_ptr_n = PRIMES_MEMORY_START + n*dw
def input_max_prime n, primes_ptr_n @ set_primes_ptr_n, bit_n, max_n, raise_more_than_max_primes, end {
    stl.output "Search primes up to: "
    input_decimal_number w, bit_n
    stl.bit2hex w, n, bit_n

    hex.cmp hw, n, max_n, set_primes_ptr_n, raise_more_than_max_primes, raise_more_than_max_primes
  set_primes_ptr_n:
    set_primes_ptr primes_ptr_n, n
    ;end

  bit_n: bit.vec w
  max_n: hex.vec hw, MAX_PRIMES

  raise_more_than_max_primes:
    raise_error "The input number should be less than ((1 << (w-2)) / w).\\n  For w=16 it's 1024.\\n  For w=32 it's ~33M.\\n  For w=64 it's ~7e16."

    end:
}


// bit[:n] = input_ascii_as_decimal. expects \\n at finish, and no other characters other then '0'-'9'.
//   example: for input "1234\\n" does bit[:n]=1234.
def input_decimal_number n, bit \
        @ input_decimal_digit, end, dec_digit, is_error, ascii, i, i_start, \
        error_handler, validate_not_empty, newline, raise_not_number_error {
    bit.zero n, bit
    bit.mov #n, i, i_start

  input_decimal_digit:
    bit.if0 #n, i, end
    bit.input ascii
    bit.ascii2dec is_error, dec_digit, ascii
    bit.if1 is_error, error_handler
    bit.mul10 n, bit
    bit.add n, bit, dec_digit
    bit.dec #n, i
    ;input_decimal_digit

  dec_digit: bit.vec n
  newline: bit.vec 8, '\\n'
  is_error: bit.bit
  ascii: bit.vec 8
  i: bit.vec #n
  i_start: bit.vec #n, n

  error_handler:
    bit.cmp 8, ascii, newline, raise_not_number_error, validate_not_empty, raise_not_number_error
  validate_not_empty:
    bit.cmp #n, i, i_start, end, raise_not_number_error, end
  raise_not_number_error:
    raise_error "Bad number given. The number should be positive, only digits, and end with a new-line."

  end:
}


// pretty way of printing an error and then exiting.
def raise_error msg {
    stl.output "\\n\\nError:\\n"
    stl.output msg
    stl.output "\\nExiting program.\\n"
    stl.loop
}


ns debug {
    // For primes_ptr == (PRIMES_MEMORY_START_VAR + p * dw), print the p.
    def print_primes_ptr_index primes_ptr @ bit_prime_index, PRIMES_MEMORY_START_VAR, end {
        stl.output "primes_ptr = &primes["
        stl.hex2bit hw, bit_prime_index, primes_ptr
        bit.sub w, bit_prime_index, PRIMES_MEMORY_START_VAR
        bit.shr w, #w, bit_prime_index
        bit.print_dec_int w, bit_prime_index
        stl.output "]\\n"
        ;end

      bit_prime_index: hex.vec w
      PRIMES_MEMORY_START_VAR: bit.vec w, PRIMES_MEMORY_START
      end:
    }
}
`,
      },
    ],
  },

  // ── 10. Multi-file Compilation ────────────────────────────────────────────
  {
    name: 'Multi-file Compilation',
    description: 'Four-file project: a library defines a macro used by the main file.',
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
        name: 'start.fj',
        content: `// start.fj — entry point; calls the startup macro - which initializes the first few fj-ops for the standard library use.
//
// This file must be compiled before any non-macro code.

stl.startup
`,
      },
      {
        name: 'main.fj',
        content: `// main.fj — uses mylib.greet from greet.fj.
//
// Try dragging start.fj and end.fj and sort the files differently — compile and see what happens.

mylib.greet "World"
mylib.greet "FlipJump"
`,
      },
      {
        name: 'end.fj',
        content: `// end.fj — calls the loop macro - actually just jumps to itself - which is the way of finishing a program in flipjump.
//
// This file must be compiled before any non-macro code.

stl.loop
`,
      },
    ],
  },
];
