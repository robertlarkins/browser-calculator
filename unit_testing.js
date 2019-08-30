/**
 * This tests a whole range of different equations to see if there are any
 * bugs in the equation calculation code. To remove the unit_testing code
 * remove this function ( run_unit_test() ), unit_test in func_list and
 * maybe the clear_user_variables() in script_using_jquery_2.js
 *
 * Need to also check that user_history and user_variables are correct
 * for a given test_equation
 *
*/
function run_unit_test() {
    
    var test_equations = [
        'a=1', 'a = 1', '=', '-', '+', '*', '^', 'sin(pi)', 'abc', 'pi'
    ];
    
    var should_error = [
        0, 0, 1, 1, 1, 1, 1, 0, 1, 0
    ];
    
    var correct_answer = ['1','1',
    
    var pass_count = 0;
    var test_count = test_equations.length;
    var result_list = '';
    
    for (var i = 0; i < test_count; i++) {
        result_list += equation_string + '\t: ';
        console.log('TEST_EQUATION = ' + i);

        clear_user_variables();
        var equation_string = test_equations[i];
        var equation_answer = processEquation(equation_string);
        
        var error_flag = equation_answer.error_flag;
        var result = equation_answer.result;
        var equation_parts = equation_answer.equation_parts;
        var error_parts = equation_answer.error_parts;
        
        if ( error_flag != should_error[i] ) {
            result_list += 'Failed.<br/>\r';
            continue;
        }
        
        if ( error_flag == 0 ) {
            console.log('equation_string = ' + equation_string);
            console.log('result = ' + result);
            console.log('equation_parts = ' + equation_parts);
            console.log('error_parts = ' + error_parts);
        } else {
            console.log('equation_string = ' + equation_string);
            console.log('result = ' + result);
            console.log('equation_parts = ' + equation_parts);
            console.log('error_parts = ' + error_parts);            
        }
    }
    
    return result_list;
}

