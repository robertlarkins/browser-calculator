
base_variables = {
    'pi': Math.PI,
    'true' : 1,
    'false' : 0,
    'undefined' : undefined,
    'NaN': NaN,
    'Infinity': Infinity,
    'infinity': Infinity,
    'Inf': Infinity,
    'inf': Infinity,
};

func_list = {
    'sin': function(theta){ return Math.sin(theta); }, 
    'cos': function(theta){ return Math.cos(theta); }, 
    'tan': function(theta){ return Math.tan(theta); }, 
    'asin': function(theta){ return Math.asin(theta); }, 
    'acos': function(theta){ return Math.acos(theta); }, 
    'atan': function(theta){ return Math.atan(theta); }, 
    'atan2': function(y, x){ return Math.atan2(y,x); },
    'sqrt': function(val){ return Math.sqrt(val); },
    'func': function() { return 1; }
};




/**
 * Generate my own error type
 * Excellent write up on javascript prototyping: http://tobyho.com/2010/11/22/javascript-constructors-and/
 *
 * http://stackoverflow.com/questions/783818/how-do-i-create-a-custom-error-in-javascript
*/
function ParseError(message, element) {
    // saw this as one way of doing it, but not sure if it works
    // as I haven't bothered to try it
    //Error.apply(this, arguments);
    this.message = (message || '');
    this.element = element;
}

// This *should* tell javascript that MyError inherits all the properties of Error
// alternative methods of doing this that I have seen are:
// MyError.prototype = Error.prototype;
// MyError.prototype = new Error();
// Not sure which one should be used or why
ParseError.prototype = Object.create(Error.prototype);
//MyError.stackTraceLimit = 0;
// Setting prototype.constructor isn't really necessary: http://stackoverflow.com/questions/4012998/what-it-the-significance-of-the-javascript-constructor-property
//MyError.prototype.constructor = ParseError;
// Reset the constructor from Error to the defined ParseError constructor
ParseError.prototype.name = 'ParseError';

/*
 *
 *
*/
function processEquation(equation_string) {
    
    var equation_answer = {
        'error_flag': 0, // If an error is found in the equation
        'result': '', // If flag == 0, then result is the calculated answer, if 1, then result is the error message
        'equation_parts': [], // The split parts of the equation
        'error_parts': [] // The parts of the equation that caused the error
    };
    
    if (equation_string.length == 0) {
        return equation_answer;
    }
    
    
    try {
        var equation_parts = getEquationParts(equation_string);
        equation_answer.equation_parts = equation_parts;
        
        var equation_structure = operator_precedence(equation_parts);
        
        // if equation_parts only contains whitespace then return
        // This occurs if no parts are returned by operator_precedence
        if ( equation_structure.part_list.length == 0 ) {
            return equation_answer;
        }
        
        // This only throws errors if there is a found problem, otherwise nothing happens
        check_adjacency(equation_structure);
        
        var precedence_list = equation_structure.precedence;
        
        var rpn = perform_shuntyard_2(equation_structure);
        // calculate the answer
        equation_answer.result = process_postfix(rpn.output_queue, rpn.index_queue);
		console.log("equation_answer.result = " + equation_answer.result);
    
    } catch (err) {
        equation_answer.error_flag = 1;
    
        if (err instanceof ParseError) {
            // Sort the identified parts that caused the error
            // sort the numbers numerically ascending instead of alphabetically
            if (err.element instanceof Array) {
                err.element.sort(function(a,b){return a-b});
            }
            
            equation_answer.result = err.message;
            equation_answer.error_parts = err.element;
        
        } else {
            equation_answer.result = 'Some other error...';
        }
    }
    
    return equation_answer;
    
}




/**
 * This gets every chunk in the equation_string
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions?redirectlocale=en-US&redirectslug=Core_JavaScript_1.5_Guide%2FRegular_Expressions#Advanced_Searching_With_Flags 
 *
*/
function getEquationParts(equation_string) {

    /** Flags
     * /Pattern/igm
     % The forward slahses denote the beggining and ending of the regex pattern
     * i = case-insentive
     * g = global match, not just the first match
     * m = multiline, where this is best used I'm not sure...
     * y = sticky search?? Firefox only
     * 
    */
    
    // In a string a backslash should be escaped (regexp escapes a forward slash automatically)
    var operator = '(!|=|<|>)=|[=<>()^\\/*+-]'; // the minus sign needs 2 backslashes if between other characters, or put it at the start or end of the character set
    var number = '(\\d+\\.?\\d*|\\.\\d+)([eE][-+]?\\d+)?'; // check for x.y if not found then try for .y
    var variable = '[A-Za-z](_?[A-Za-z0-9]+)*'; // variables and functions, must start with letter, can contain single underscores between letters and numbers, but must end on a letter or number
    var separator = '[,;]';
    var whitespace = '\\s+';
    
    var pattern = new RegExp(number+'|'+operator+'|'+variable+'|'+separator+'|'+whitespace, 'g');

    var matchEnd = 0;
    var equation_parts = [];
    
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
    // go through each possible match and collect it, along with all the text
    // that occurs between the matches.
    // match.index gives the start of match in equation_string
    // pattern.lastIndex gives the index of the next starting location to check
    while ((match = pattern.exec(equation_string)) !== null) {
        // If match.index is greater than matchEnd then there is uncollected text
        // before match that needs to be added
        if ( match.index > matchEnd ) {
            var other = equation_string.substring(matchEnd, match.index);
            equation_parts.push(other);
        }
        // Store the found match
        equation_parts.push(match[0]);
        matchEnd = pattern.lastIndex;
    }

    if (matchEnd < equation_string.length) {
        var other = equation_string.substring(matchEnd);
        equation_parts.push(other);
    }
    
    return equation_parts;
}

/**
 * This function check if there is any issues between adjacent tokens and throws errors is there is
 * It is employed to tidy up the shuntyard and postfix functions, as well as identifying errors
 * that they are not really designed to find. Such as trying to assign variables inside equations.
 *
 *  Precedence Values
 *  0 : comma
 *  1 : number or variable (they both have the same precedence)
 *  2 : '=', the equal sign, its associativity has been removed (this should be right to left associative, same as ^ and -u)
 *  3 to add = logical or: ||
 *  4 to add = logical and: && 
 *  5 : relational operators: == != < <= > >=
 *  6 = + -, addition and subtraction
 *  7 = / *, division and multiplication
 *  8 = ^, exponent or power symbol, its has right to left associativity
 *  9 = unary plus and minus (+u and -u)
 *      when a minus follows an infix operator, an open paren, or comes at the
 *      beginning of the input, it should be considered unary.
 *  10 = function
 *  11 = ( ) and potentially other bracket types
 *
 *
*/
function check_adjacency(equation_structure) {
    
    var precedence_list = equation_structure.precedence; // the precedence of each part
    var part_list = equation_structure.part_list; // the actual equation part
    var part_index = equation_structure.part_index; // the index of the equation part in the original string of equation_parts
    
    var no_parts = part_list.length;
    
    // Pattern Sets
    operator_pattern = /^(!|=|<|>)=|[=<>()^\/*+-]$/;
    fv_pattern = /^[A-Za-z](_?[A-Za-z0-9]+)*$/; // function and variable pattern
    number_pattern = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
    
    for ( var i = 0; i < no_parts; i++) {
        var token = part_list[i];
        var precedence = precedence_list[i];
        var epi = part_index[i];
        
        // deal with separators
        if (precedence == 0) {
            // a separator can't be at the end of an equation or at the start
            // it must also follow a variable, number or a close bracket
            // example equations:  ,   12,  (,)   1+,
			// i == 0 || i == no_parts-1 ||    this section from if statement removed
            if (i != 0 && precedence_list[i-1] != 1 && part_list[i-1] != ')') {
                throw new ParseError('Error: Fragmented equation (unexpected \'' + token + '\' separator). [ERR001]', epi );
            }
    
        // deal with numbers and variables
        } else if ( precedence == 1 ) {
            // Deals with two numbers next to each other, or a number directly after a close bracket.
            // example equations:  12 34   (1+2)3
            if (i >= 1 && (precedence_list[i-1] == 1 || part_list[i-1] == ')')) {
                throw new ParseError('Error: Fragmented equation (unexpected number or variable). [ERR002]', epi );
            }
            
        // deal with '='
        } else if ( precedence == 2 ) {
            // Make sure the '=' isn't at the start or end
            // example equations:  =123    abc=
            if (i == 0 || i == no_parts-1) {
                throw new ParseError('Error: Fragmented equation (unexpected \'=\' operator). [ERR003]', epi );
            }
            
            // i == 0 has been dealt with, now make sure that it is being assigned to a variable and not a number
            // example equations:  *=12   5=34   (ab)=23
            if ( precedence_list[i-1] != 1 || fv_pattern.test( part_list[i-1] ) == false) {
                throw new ParseError('ERROR: Invalid assignment, (expected a variable). [ERR004]', getRangeArray(part_index[i-1],epi) );
            }
            
            // This ensures that an assignment can't occur in the middle of an equation
            // currently it cannot be performed after a ';', though this functionality should be coming
            // (part_list[i-2] != '=' || part_list[i-2] != ';') <---- Note: this doesn't check if ';' is inside square brackets, which have yet to be implemented
            /*
            if (i >= 2 && part_list[i-2] != '=') {
                throw new ParseError('Error: Ill constructed equation (Do not perform assignments mid equation). [ERR005A]', epi );
            }
            */
            
            // This is similar to the above restrictions, but allows the assignment to be performed in the middle of an equation
            // but only after a '(' '=' ';' or ','
            // example equations:  ab=2 then 3*ab=5
            /*
            if (i >= 2 && part_list[i-2] != '=' && part_list[i-2] != '(' && part_list[i-2] != ';' && part_list[i-2] != ',') {
                throw new ParseError('Error: Ill constructed equation (unexpected assignment - look up operator precedence). [ERR005B]', epi );
            }*/

            // Allows the equation to be performed after a semicolon
            if (i >= 2 && part_list[i-2] != '=' && part_list[i-2] != ';' && part_list[i-2] != ',') {
                throw new ParseError('Error: Ill constructed equation (unexpected assignment - look up operator precedence). [ERR005C]', epi );
            }
            
            
        // deal with the operators except unary
        } else if ( precedence >= 3 && precedence <= 8) {
            // an operator (except unary) can't be at the start or end of an equation
            // an operator must follow a closed bracket, number or variable
            // example equations:  *12    34/    (/7)    3*/6
            if (i == 0 || i == no_parts-1 || precedence_list[i-1] != 1 && part_list[i-1] != ')') {
                throw new ParseError('Error: Fragmented equation (unexpected \'' + token + '\' operator). [ERR006]', epi );
            }
            
        // deal with unary operators
        } else if (precedence == 9) {
            // a unary can't be at the end of an equation
            // example equations:  9+-
            if ( i == no_parts-1) {
                // the ternary operator is employed as unary operators are store as '+u' and '-u'
                throw new ParseError('Error: Fragemented equation (unexpected \'' + (token=='+u'?'+':'-') + '\' operator). [ERR007]', epi);
            }
       
        // deal with functions
        } else if (precedence == 10) {
            // function can only follow an open bracket or an operator or a comma
            // example equations:  (1)sin(pi)    8tan(.5)
            if ( i >= 1 && part_list[i-1] != '(' && !(precedence_list[i-1] >= 2 && precedence_list[i-1] <= 9) && part_list[i-1] != ',' ) {
                throw new ParseError('Error: Fragmented equation (unexpected \'' + token + '\' function). [ERR008]', epi );
            }

            // a function can't be at the end of an equation, it must also be followed by an open parenthesis
            // example equations:  cos    cos*3
            if ( i == no_parts-1 || part_list[i+1] != '(' ) {
                throw new ParseError('Error: A function should be followed by a \'(\'. [ERR009]', epi );
            }

        // deal with brackets
        } else if (precedence == 11) {
        
            if (token == '(') {
                // open bracket cant be at end of equation
                // previous token cant be a variable, number or a close parenthesis
                // (as it must be an operator, function, open bracket or a separator)
                // example equations:  3(    abc(    (1)(
                if ( i >= 1 && (precedence_list[i-1] == 1 || part_list[i-1] == ')')) {
                    throw new ParseError('Error: Fragmented equation (unexpected \'' + token + '\' parenthesis.). [ERR010]', epi );
                }
            
            } else if (token == ')') {
                // the closing parenthesis must follow a number, variable or another closing parethesis
                // the exception is it can follow an open parenthesis if the one prior to it is a function
                // example equations:  )    +)    (1*)    ()
                if (i == 0 || precedence_list[i-1] != 1 && part_list[i-1] != ')' && !(i >= 2 && precedence_list[i-2] == 10)) {
                    throw new ParseError('Error: Fragmented equation (unexpected \'' + token + '\' parenthesis.). [ERR011]', epi );
                }
                
            }
        
        } else if (token === ';') {
            
            if (i == 0 || precedence_list[i-1] != 1 && part_list[i-1] != ')') {
                throw new ParseError('Error: Fragmented equation (unexpected \'' + token + '\' parenthesis.). [ERR012]', epi );
            }
            
        }
        
        
    
    }
}


/* Get the precedence of a passed in token
 * This function classifies each equation part as well as throwing errors if there are adjacency issues
 *
 *
*/
function operator_precedence(equation_parts) {

    //function_list = ['sin', 'asin', 'cos', 'acos', 'tan', 'atan', 'atan2', 'sqrt'];

    var precedence_list = [];
    var part_index = [];
    var part_list = [];

    // Pattern Sets
    var operator_pattern = /^(!|=|<|>)=|[=<>()^\/*+-]$/;
    var fv_pattern = /^[A-Za-z](_?[A-Za-z0-9]+)*$/; // function and variable pattern
    var number_pattern = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
    
    
    
    /* these values are used to indicate precedence and type
    -1 = rubbish
    0 = comma
    numbers and variables dont have a precedence
    1 = number or variable (they both have the same precedence)
    2 to add = equal sign (this should be right to left associative, same as ^ and -u)
    3 to add = logical or: ||
    4 to add = logical and: && 
    5 to add = relational: == != < <= > >=
    6 = + -
    7 = / *
    8 = ^
    9 = unary minus
        when a minus follows an infix operator, an open paren, or comes at the
        beginning of the input, it should be considered unary.
    10 = function
    11 = ( ) and potentially other bracket types
    
    99 = other operators, such as the semicolon
    
    semi-colon when found is either part of a matrix, or end of an equation
    if it's a semi-colon in a matrix, count how many rows occur, as if a matrix
    is given as
    [1 2 3; 4 5 6]
    which given in postfix will be
    1 2 3 4 5 6 3 2 -m
    which is the matrix, the number of columns, number of rows, -m identifies that it's a matrix
    
    if at the end of the equation, then pop everything off of the stack onto the output queue
    start a new output queue if there is more tokens in the infix queue (equation_parts)
    
    */
    for ( var i = 0; i < equation_parts.length; i++) {
        token = equation_parts[i];
    
        // Check if the part is a comma (occurs when calling a function)
        if (token === ',') {
            precedence_list.push(0);
    
        // Check if the equation part is a number
        } else if ( number_pattern.test(token) ) {
            precedence_list.push(1);
    
        // Check if equation part is an equals
        } else if (token === '=') {
            precedence_list.push(2);
    
        // logical or
        } else if (token === '||') {
            precedence_list.push(3);
            
        // logical and
        } else if (token === '&&') {
            precedence_list.push(4);

        // relationals == != < <= > >=
        } else if (token === '==' || token === '!=' || token === '<' || token === '>' || token === '<=' || token === '>=') {
            precedence_list.push(5);
            
        } else if (token === '+' || token === '-') {
            // Check if the + or - are unary, this occurs if they are at the start of the
            // equation or follow a ( ^ / * + - ,
            // the forwardslash is backslashed
            // because unary opperators are changed to -u or +u, need to check for these
            if ( i == 0 || /^[(^\/*+\-,=<>]|\-u|\+u$/.test(equation_parts[i-1]) ) { 

                precedence_list.push(9);
                token = token.concat('u');
                    
            // Otherwise it is a standard + or -  
            } else {
                precedence_list.push(6);
            }

        } else if (token === '/' || token === '*') {
            precedence_list.push(7);
            
        } else if (token === '^') {
            precedence_list.push(8);
            
           
        // Check if the part is a function or variable
        } else if ( /^[A-Za-z](_?[A-Za-z0-9]+)*$/.test(token) ) {
            
            // Check to see if the part is in the function list and is followed by a bracket
            // which is expected and needed
            // If inArray == -1 then its not in the array, so its a variable
            //if ($.inArray(token, function_list) == -1)
            // func_list is checked first, as functions are reserved and cannot be used as variables (matlab allows this to occur, but I'm not allowing it).
            if (token in func_list) {
                precedence_list.push(10);
            } else {
                precedence_list.push(1);
            }
          
        } else if (token === '(' || token === ')') { // Strict comparison, both items must be the same type
            precedence_list.push(11);
        
        } else if ( /\s+/.test(token) ) {
            // Check if token is whitespace and just skip
            continue;
            
        } else if ( token === ';') {
            precedence_list.push(99);
        
        } else {
            // example equations: @#$   !!!   ___
            throw new ParseError('ERROR: \'' + token + '\' is an unknown operator. [ERR012]', i);
        }
        
        part_index.push(i);
        part_list.push(token);
    }

    
    return {'precedence' : precedence_list,
            'part_index' : part_index,
            'part_list' : part_list};

}




/* precedence
    -1 = rubbish
    0 = comma
    numbers and variables dont have a precedence
    1 = number or variable (they both have the same precedence)
    2 is '=', the equal sign (this should be right to left associative, same as ^ and -u)
    3 to add = logical or: ||
    4 to add = logical and: && 
    5 relational: == != < <= > >=
    6 = + -
    7 = / *
    8 = ^
    9 = unary minus
        when a minus follows an infix operator, an open paren, or comes at the
        beginning of the input, it should be considered unary.
    10 = function
    11 = ( ) and potentially other bracket types
*/
function perform_shuntyard_2(equation_structure) {
    // the list of equation parts with whitespace removed
    var part_list = equation_structure.part_list;
    // the precedence of each equation part
    var precedence_list = equation_structure.precedence;
    // The actual position of the equation part in the equation
    var part_index = equation_structure.part_index;
    
    
    console.log('precedence list = ' + precedence_list);
    console.log('part index = ' + part_index);
    
    var output_queue = []; // use push and shift
    var element_index_queue = []; // retain the position of each element for error tracking
    var stack = []; // use push and pop (these work at the end of the array)
    
    // This is used to count how many arguments are in the function
    // an array is used as there can be multiple levels of functions, eg: atan2(sin(0),cos(pi))
    var func_comma_count = [];

    for (var i = 0; i < part_list.length; i++) {
        // Read a token and its precedence
        var token = part_list[i];
        var precedence = precedence_list[i];
        var epi = part_index[i]; // equation part index
    
            
        // If the token is a number or a variable, then add it to the output queue
        if (precedence == 1) {
            output_queue.push(token);
            element_index_queue.push(epi);
            
        // If the token is a function token then push it onto the stack.
        } else if (precedence == 10) { 
            stack.push(i);
            func_comma_count.push(0);
            
        // If the token is a left parenthesis
        } else if (token == '(') {
            stack.push(i);
            
            
        // If the token is a function argument separator (e.g., a comma)
        } else if (token == ',') {
            // Keep popping items off of the stack onto the queue until '(' is found
            while (stack.length != 0 && part_list[stack[stack.length - 1]] != '(') {
                var stack_i = stack.pop();
                output_queue.push(part_list[stack_i]);
                element_index_queue.push(part_index[stack_i]);
            }
        
            // If no left parentheses are encountered, either the separator
            // was misplaced or parentheses were mismatched.
            // example equations: 2,3
            if (stack.length == 0) {
				// this could instead be deemed as the end of an equation
				output_queue.push(token);
				element_index_queue.push(part_index[i]);				
				continue;
                //throw new ParseError('Error: No left parentheses found. Commas are used to separate function arguments. [ERR013]', epi);
            }
            
            func_comma_count[func_comma_count.length-1] += 1;
          
        // End of equation
        } else if (token === ';') {
            // Push everything that is on the stack onto the output, clear the stacks
            // and continue
            
            // pop items off of the stack onto the output queue
            while (stack.length > 0) {
                var stack_i = stack.pop();
        
                // example equations:  (1+2;    2*(1/2;
                if (part_list[stack_i] == '(') {
                    throw new ParseError('ERROR: No matching right parentheses. [ERR015a]', part_index[stack_i]);
                }
           
                output_queue.push(part_list[stack_i]);
                element_index_queue.push(part_index[stack_i]);
            }
            
            output_queue.push(token);
            element_index_queue.push(part_index[i]);
        
        // If the token is an operator, o1, then:
        } else if (precedence >= 2 && precedence <= 9) {

            while (stack.length > 0) {
                
                // Stop popping items off of the stack if a left bracket is found
                if (part_list[stack[stack.length - 1]] == '(') {
                    break;
                }

                stack_precedence = precedence_list[stack[stack.length - 1]];
                    
                    
                // while there is an operator token, o2, at the top of the stack, and    
                // either o1 is left-associative and its precedence is less than or equal to that of o2,
                // or o1 has precedence less than that of o2,
                // This associtivity is needed for stacking together unary operators
                
                // do right associative with unary, powers and equals(9, 8 and 2)
                if (precedence == stack_precedence && stack_precedence != 9 && stack_precedence != 8 && stack_precedence != 2 || precedence < stack_precedence) {
                    // pop index of o2 off the stack, and push o2 onto the output queue;
                    var stack_i = stack.pop();
                    output_queue.push(part_list[stack_i]);
                    element_index_queue.push(part_index[stack_i]);
                    
                } else {
                    // No longer need to remove items from the stack
                    break;
                }

            }
            
			// This allows assignments after commas, but not if they are inside a function
			// This can be removed with no detrimental effect when processing the equation
			// (it expands the ways equations can be expressed, but also makes them a bit more convoluted)
			// example equations:  atan2(3,a=4)
			if (precedence == 2 && stack.length > 0) {
				throw new ParseError('Error: Ill constructed equation. [ERR016]', epi);
			}			
			
            // push o1 onto the stack.
            stack.push(i);
        }
        
        // If the token is a right parenthesis:
        else if (token == ')') { 
            
            // pop items off the stack until the stack is either empty or a
            // left bracket is found
            while (stack.length != 0 && part_list[stack[stack.length - 1]] != '(') {
                // Pop token off of stack until the stack is either empty or a left bracket is found
                //output_queue.push(equation_parts[stack.pop()]);
                var stack_i = stack.pop();
                output_queue.push(part_list[stack_i]);
                element_index_queue.push(part_index[stack_i]);
            }
            
            // This is checked here in case the stack is emptied
            // example equations:  1+2*3)
            if (stack.length == 0) {
                throw new ParseError('ERROR: No matching left parentheses. [ERR014]', epi);
            }
            
            // Remove the left parenthesis index from the stack, but not onto the output queue
            stack.pop();
            
            // If the token at the top of the stack is a function token, pop it onto the output queue.
            // it is expected that a function is followed by open and close brackets
            // also push onto the output queue the number of found arguments
            if (precedence_list[stack[stack.length - 1]] == 10) {
                // check if there is no input
                // because the current token is a ')', then there are no arguments if the previous token is a '('
                if ( part_list[i-1] == '(' ) {
                    output_queue.push( func_comma_count.pop() );
                } else {
                    // If there are arguments, then there is one more argument than there is commas
                    output_queue.push( func_comma_count.pop() + 1 );
                }
                // push a place holder on for the number of arguments
                element_index_queue.push(NaN);
                
                //output_queue.push(equation_parts[stack.pop()]);
                var stack_i = stack.pop();
                output_queue.push(part_list[stack_i]);
                element_index_queue.push(part_index[stack_i]);
            }
            
        }
    }

    // pop items off of the stack onto the output queue
    while (stack.length > 0) {
        var stack_i = stack.pop();
        
        // example equations:  (1+2    2*(1/2
        if (part_list[stack_i] == '(') {
            throw new ParseError('ERROR: No matching right parentheses. [ERR015]', part_index[stack_i]);
        }
        
        output_queue.push(part_list[stack_i]);
        element_index_queue.push(part_index[stack_i]);
    }

    return {'output_queue' : output_queue, 'index_queue' : element_index_queue};
}


function process_postfix(postfix_queue, index_queue) {
    console.log('process_postfix : postfix_queue = ' + postfix_queue);
    console.log('process_postfix : index_queue = ' + index_queue);
    
    var stack = [];
    var index_stack = [];
	var final_answer = [];
	var final_answer_index_stack = [];
    
    // Check if the token is a variable
    operator_pattern = /^(!|=|<|>)=|[=<>()^\/*+-]$/;
    // May need to exluded NaN, undefined, true and false in this
    fv_pattern = /^[A-Za-z](_?[A-Za-z0-9]+)*$/; // function and variable pattern

    for (var i = 0; i < postfix_queue.length; i++) {
        var token = postfix_queue[i];
        
        // Check if the element in the queue is a number (both string and float/int type)
        if (isNaN(token) == false) {
            // The + does nothing to a number, but will convert a number string to a number
            // the function parseInt(num) can extract the numeric part from the start of a string, but it truncates floats to an int. Math.floor() is better if this functionality is desired.
            // parseFloat(num) could also be used if necessary
            stack.push(+token);
            //index_stack.push(index_queue[i]);
            index_stack.push(i);
        }
        
        // Check if the token is an operator
        // Do this using regex
        else if (operator_pattern.test(token) == true ) {
            
            // All these functions require 2 inputs
            /*
            if (stack.length < 2) {
                throw new ParseError('ERROR: Insufficient Values for operator (Incomplete Equation): in process_postfix.', index_queue[i]);
            }
            */
            
            // arg1 is below arg2 on the stack
            var arg2 = stack.pop();
            var arg1 = stack.pop();
            console.log('index_stack = ' + index_stack);
            console.log('token \' ' + token + ' \', arg1 is ' + arg1 + ', arg2 is ' + arg2);
            var arg2_index = index_queue[ index_stack.pop() ];
            var arg1_oi = index_stack.pop(); // The original index of arg1
            var arg1_index = index_queue[ arg1_oi ];
            
            // check if arg1 is a variable
            // if arg1 is a variable and it is not being assigned, then retrieve it
            if ( fv_pattern.test( arg1 ) == true && token !== '=') {

                if ( arg1 in user_variables ) {
                    arg1 = user_variables[arg1];
                        
                } else if ( arg1 in base_variables ) {
                    arg1 = base_variables[arg1];
                        
                } else {
                    // arg1 doesn't exist
                    // example equations:  abc*efg    (var)+2
                    throw new ParseError('ERROR: \'' + arg1 + '\' is an unknown variable. [ERR501]', arg1_index);
                }
            }
            
            // Check if arg2 is a variable
            if ( fv_pattern.test( arg2 ) == true ) {
                if ( arg2 in user_variables ) {
                    arg2 = user_variables[arg2];
                        
                } else if ( arg2 in base_variables ) {
                    arg2 = base_variables[arg2];
                        
                } else {
                    // arg2 doesn't exist
                    // example equations:  2+abc   3*(abc)
                    throw new ParseError('ERROR: \'' + arg2 + '\' is an unknown variable. [ERR502]', arg2_index);
                }
            }

            // Evaluate the operator using arg1 and arg2
            calculated_answer = evaluate_operator(token, arg1, arg2);
                
            // Push the returned result back onto the stack
            stack.push(calculated_answer);
            index_stack.push(NaN);
        }
        
        else if (token == '-u' || token == '+u') { // check if the token is a negative unary
            
            var stack_token = stack.pop();
            
            if ( fv_pattern.test( stack_token ) == true ) {

                if ( stack_token in user_variables ) {
                    stack_token = user_variables[stack_token]
                        
                } else if ( stack_token in base_variables ) {
                    stack_token = base_variables[stack_token];
                        
                } else {
                    // example equations: ---abc
                    throw new ParseError('ERROR: \'' + stack_token + '\' is an unknown variable. [ERR503]', index_queue[ index_stack[index_stack.length-1] ]);
                }
            }
        
            // Take the number off of the stack, apply the negative unary operator
            // and put it back on the stack, but only if it is -u, as +u is redundant
            if (token == '+u') {
                continue;
            }
            
            stack.push( -stack_token );
            
        }
        
        // Check if the token matches the standard variable or function structure
        // if so, check if it its a known variable, a function, or push it onto the stack as is as an equals sign should be coming up in the queue
        else if ( fv_pattern.test(token) ) {
        
        
            // Check if the token is a known function
            if (token in func_list) {

                var num_args = stack.pop();
                index_stack.pop();
                
                // Get the list of args
                arg_list = [];
                
                for (var arg_no = 0; arg_no < num_args; arg_no++) {
                    var arg = stack.pop();
                    var arg_index = index_queue[ index_stack.pop() ];
            
                    if ( fv_pattern.test( arg ) == true ) {

                        if ( arg in user_variables ) {
                            arg = user_variables[arg]
                                
                        } else if ( arg in base_variables ) {
                            arg = base_variables[arg];
                                
                        } else {
                            // example equations:  sin(abc)
                            throw new ParseError('ERROR: \'' + arg + '\' is an unknown variable. [ERR504]', arg_index);
                        }
                    }
                
                    // the args are in reverse order in the stack
                    // so put them in reverse order in the arg_list
                    arg_list.unshift(arg); // unshift adds items to start of array
                }
                
                // The postfix equation for functions tell us how many args are being passed into the function.
                var func = func_list[token]; // func should be a callable function
                
                // check that func takes as many arguments as has been supplied
                // func.length gets the number of arguments
                // arguments.length gives the number of arguments passed into the function
                if ( func.length != num_args ) {
                    //example equations:  sin(1,2)    atan2()
                    throw new ParseError('ERROR: The \'' + token + '\' function expects ' + func.length + ' argument' + ((func.length == 1)? '.' :'s.') + ' Not ' + num_args + ' argument' + ((num_args == 1)? '.' :'s.'), index_queue[i]);
                }
                
                // apply expands the array into function arguments
                calculated_answer = func.apply(null, arg_list); 
                
                stack.push(calculated_answer);
                index_stack.push(NaN);

            } else { // token is either in user_variables or is about to be assigned
            
                // While intrinsically it would be expected that the value the variable contains could just be pushed onto the stack here
                // it shouldn't be done as it is possible the variable is reassigned deeper in the equation, changing the variable value
                // while the pushed on value remains the same on the stack
                stack.push( token ); // added
                index_stack.push(i);

            }
               
        } else if (token === ';') {
			// If stack.length == 0, then there was only a semi-colon
			if (stack.length == 0) {
				continue;
			}
		
            // semicolon indicates end of equation, therefore clear the stack
            // and prepare for another possible equation
            if (stack.length > 1) {
                throw new ParseError('ERROR: Incorrect postfix equation. This should not happen. [ERR506a]', NaN);
            }
			
			// Check if the item isn't just a variable, if it is, check to see if it is legal
			// This 'if' section could be discarded without any real adverse affect
			if ( fv_pattern.test( stack[0] ) && stack[0] != 'NaN' && stack[0] != 'undefined' && stack[0] != 'Infinity') {
		
				if ( !(stack[0] in user_variables) || !(stack[0] in base_variables) ) {
					throw new ParseError('ERROR: \'' + stack[0] + '\' is an unknown variable. [ERR507b]', index_queue[ index_stack[0] ]);
				}
			}
			
            console.log('clearing stack now!');
            stack = [];
            index_stack = [];

        } else if (token === ',') {
			// If stack.length == 0, then there was only a comma
			if (stack.length == 0) {
				continue;
			}
		
            // semicolon indicates end of equation, therefore clear the stack
            // and prepare for another possible equation
            if (stack.length > 1) {
                throw new ParseError('ERROR: Incorrect postfix equation. This should not happen. [ERR506b]', NaN);
            }
            
            // End of equation string reached, and as there is no 
            // answer to return, then return and empty array
            if ( i < postfix_queue.length-1) {
				final_answer.push(stack[0]);
				final_answer_index_stack.push(index_stack[0]);
				console.log('clearing stack now!');
				stack = [];
				index_stack = [];                
            }

        }
    }

    
    // The stack should now only contain one number: the answer to the equation
    // If not, then there is a problem.
    // This is a last stage in which to find any problems in the equation
    if (stack.length > 1) {
        console.log('error stack = ' + stack);
        throw new ParseError('ERROR: Incorrect postfix equation. This should not happen. [ERR506c]', NaN);
    }
    
	if (stack.length == 1) {
		final_answer.push(stack[0]);
		final_answer_index_stack.push(index_stack[0]);
	}
    
	for (var i = 0; i < final_answer.length; i++) {

		// Otherwise check that the item isn't just a variable, if it is, get the corresponding value or return the calculated answer
		if ( fv_pattern.test( final_answer[i] ) && final_answer[i] != 'NaN' && final_answer[i] != 'undefined' && final_answer[i] != 'Infinity') {
		
			if ( final_answer[i] in user_variables ) {
				final_answer[i] = user_variables[ final_answer[i] ];

			} else if ( final_answer[i] in base_variables ) {
				final_answer[i] = base_variables[ final_answer[i] ];
				
			} else { // This struck if only an unknown variable is called (example: 'abc', without having assigned abc)
				// example equations:  abc
				throw new ParseError('ERROR: \'' + final_answer[i] + '\' is an unknown variable. [ERR507a]', index_queue[ final_answer_index_stack[i] ]);
			}
		}
	}
	
 	return final_answer;

}

function getRangeArray(start, end) {
    if(arguments.length == 1) {
        end = start;
        start = 0;
    }    

    var range = [];
    for (var i = start; i <= end; i++)
        range.push(i);
    
    return range;
    
}



function evaluate_operator(operator, arg1, arg2) {

    switch (operator) {
        case '^': return Math.pow(arg1, arg2);
        case '/': return arg1 / arg2;
        case '*': return arg1 * arg2;
        case '+': return arg1 + arg2;
        case '-': return arg1 - arg2;
        case '=': 
            // create new var based on arg1, and assign it a value using arg2.
            user_variables[arg1] = arg2;
            return arg2;
        // ternary operator is used to return 1 or 0 instead of true and false
        case '==': return arg1 == arg2 ? 1 : 0; 
        case '!=': return arg1 != arg2 ? 1 : 0;
        case '<': return arg1 < arg2 ? 1 : 0;
        case '<=': return arg1 <= arg2 ? 1 : 0;
        case '>': return arg1 > arg2 ? 1 : 0;
        case '>=': return arg1 >= arg2 ? 1 : 0;
        default: throw new ParseError('ERROR: operator not recognised. This should not happen. [ERR601]', NaN);
    }

}