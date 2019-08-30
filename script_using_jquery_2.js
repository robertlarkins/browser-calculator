/* old precedence
-1 = rubbish
0 = comma
1 = number
2 = variable (should have the same precedence as number, but the
    value indicates its type
3 = + -
4 = / *
5 = ^
6 = unary minus
    when a minus follows an infix operator, an open paren, or comes at the
    beginning of the input, it should be considered unary.
7 = function
8 = (
9 = )
*/

// This adds code to the DOM as early as possible, where this code adds functionality to
// the elements contained within the page
$(document).ready(

    // When enter (keyCode 13) is pressed and let go in the element #equation_input
    // then perform the function processEquation
    function() {
    
        $('#expandingArea').each( function() {

            var area = $('#text_in', $(this));
            
            // This updates #text_in for the first run incase it contains any text
            update_textin();
        
            // Bind a function to the input event
            // When textarea value changes, update the span text
            area.bind('input', function() {
                update_textin();
            });
        
        });

        $('#text_in').mouseup( function(event) {
            // 'this' references the object that employs the event, which is #text_in
            var selectStart = $(this).prop('selectionStart');
            var selectEnd = $(this).prop('selectionEnd');
            // only call side_buffering if no text is selected
            if ( selectStart == selectEnd ) {
                side_buffering();
            }
        });
    
        $('#text_in').keyup( function(event) {
            
            // If ctrl + enter is pressed
            if (event.ctrlKey && (event.which == 10 || event.which == 13)) {
                var selectStart = $('#text_in').prop('selectionStart');
                var selectEnd = $('#text_in').prop('selectionEnd');
                var current_text = $(this).val();
                var text_start = current_text.substring(0,selectStart);
                var text_end = current_text.substring(selectEnd);
                $(this).val( text_start + '\n' + text_end );
                update_textin();
                // Place the cursor in the correct position (straight after the newline)
                $('#text_in')[0].setSelectionRange(selectStart+1, selectStart+1);

                // Ensure the equation area is all the way to the bottom so that textarea
                // cursor doesn't go below the visible scroll area (it doesn't go below
                // the available scroll area, the content stays stationary instead of shifting)
                $('#equation_area').scrollTop($('#equation_area').prop('scrollHeight'));
                
            } else if (event.which == 10 || event.which == 13) {
                processEquation_getInput();
                update_textin();
                //alert('enter key pressed');
            }
            
            // If an arrow key, home, or end is pressed then call side_buffering
            // This currently responds very slowly, either because it is tied to
            // keyup or for some other reason
            // Using keydown doesn't work, as updating the scroll bar occurs after
            // keydown is called.
            switch (event.which) {
                // an empty case drops down to the next case
                case 35: // end
                case 36: // home
                case 37: // left arrow
                case 38: // up arrow
                case 39: // right arrow
                case 40: side_buffering(); // down arrow
            }
            
        });
    
        $('#text_in').keydown( function(event) {

            console.clear();
        
            if (event.which == 10 || event.which == 13) {
                event.preventDefault();
            }
        
            // if the up key is pressed
            else if (event.ctrlKey && event.which == 38) {

                var equation_string = $('#text_in').val();
                var history_item = searchUserHistory_2(equation_string, 1);
                $('#text_in').val( history_item );
                update_textin();
                
            // if the down key is pressed
            } else if (event.ctrlKey && event.which == 40) {

                var equation_string = $('#text_in').val();
                var history_item = searchUserHistory_2(equation_string, -1);
                $('#text_in').val( history_item );
                update_textin();
            }
            
        });

    }
    
);


// the width of the maximum span within the equation area
// it is maintained for ensuring the scroll bars occur when they should
var max_span_width = 0;

/**
 * Each time text is entered into #text_in, we need to check if its length needs to
 * be adjusted. The maximum width is the maximum of the
 *    #equation_area width
 *    max_span_width
 *    #hidden_span width
 *
 * The elements whose widths are set to the maximum width are
 *    #text_in
 *    #exapandingArea
 *    the .ans class
*/
function update_textin() {

    var span = $('#hidden_span');
    
    span.text( $('#text_in').val() );
    
    // Get the total width of equation_area incase it is wider than the span width
    // clientWidth is the visible width area, taking into account if scrollbar is visible
    var panel_width = $('#equation_area')[0].clientWidth - $('.double_arrow').outerWidth();

    var max_width = Math.max(span.width(), panel_width, max_span_width);
    console.log('span.width() = ' + span.width());
    console.log('panel_width = ' + panel_width);
    console.log('max_span_width = ' + max_span_width);

    // This if statement isn't necessary, it just makes sure that text_in always
    // has a 20px buffer from the last character at the end.
    if (span.width() > max_width-edge_buffer) {
        max_width += edge_buffer - (max_width-span.width());
        console.log('in span width = ' + max_width);
    }
    console.log('outer = ' + max_width);
    // This currently doesn't take into account the borders of text_in
    // and expandingArea
    $('#text_in').css('width', max_width+'px');
    $('#expandingArea').css('width', max_width+'px');
    $('.ans').css('width', max_width+'px');
    
    // 
    side_buffering();
    
}

// text_in edge buffer for when text is entered
var edge_buffer = 20;
/**
 * This function scrolls #text_in so that the caret isn't hard up against
 * the #equation_area sides. This ONLY changes the #equation_area horizontal
 * scroll bar
*/
function side_buffering() {
    // Ensure that the textin area scrolls properly with span width
    // This uses the:
    // <script src="textarea-helper.js"></script>
    // it is a separate library called textarea-helper that gets the x,y pixel
    // position of the caret
    // It comes from here: https://github.com/Codecademy/textarea-helper

    // Get the distance the caret is from the two sides of the equation area
    // The caret_xy_pos.left starts at 0, therefore if the caret is at the start
    // its position is labelled 0 even though it could be said that it is 1 
    // pixel out from the edge.
    var caret_xy_pos = $('#text_in').textareaHelper('caretPos');
    var lefter = caret_xy_pos.left+$('.double_arrow').outerWidth();
    var left_dist = lefter - $('#equation_area').scrollLeft();
    // $('#equation_area').scrollLeft() gives the width of stuff hidden to the left
    var righter = $('#equation_area').scrollLeft() + $('#equation_area')[0].clientWidth;
    var right_dist = righter - caret_xy_pos.left - $('.double_arrow').outerWidth();
    
    
    // Now shift the scroll bar so that the carat is positioned at 20
    if (left_dist < edge_buffer) {
        $('#equation_area').scrollLeft($('#equation_area').scrollLeft()-edge_buffer+left_dist);
    }
    
    // Note: there is a flaw in scrollLeft in that it doesn't update the
    // scroll bar until *after* this function is called, therefore, if a
    // character is added, it is the width of the character behind    
    if (right_dist < edge_buffer) {
        $('#equation_area').scrollLeft($('#equation_area').scrollLeft()+edge_buffer-right_dist);
    }
    
    if (caret_xy_pos.left == 0) {
        $('#equation_area').scrollLeft(0);
    }
    

}

user_variables = { };
max_history_elements = 10;
user_history = [];
user_history_position = 0;
initial_equation_string = '';
current_equation_string = '';
max_width = 0; // current maximum width of elements that sit next to double arrow ( >> )

function clear_user_variables() {
    user_variables = {};
    $('#variable_list').empty();
}


/* Used for the calculate button
 *
 *
*/
function processEquation_getInput() {
    console.clear();
    var equation_string = $('#text_in').val();
    
    //max_span_width = Math.max( max_span_width, $('#hidden_span').width() );
    //This span and if statement increase max_span_width inorder to allow a buffer 
    // at the end of long equations, so that the equation in the answer line
    // wont touch the #equation_area right-hand edge
    var span = $('#hidden_span');
    
    if (span.width() > max_span_width-edge_buffer) {
        max_span_width += edge_buffer - (max_span_width-span.width());
        console.log('spanwidth in input = ' + max_span_width);
    }
    
    
    console.log('in processEquation_getInput()');

    var equation_answer = processEquation(equation_string);
    var error_flag = equation_answer.error_flag;
    var result = equation_answer.result;
    var equation_parts = equation_answer.equation_parts;
    var error_parts = equation_answer.error_parts;

    // Check if processEquation produced an error
    // If it didn't then output the answer
    // Otherwise output the error
    if ( error_flag == 0 ) {
        // if result is empty (this occurs if the equation output is suppressed using a semicolon)
        // then we dont need the answer output component

		var answer_line = 
			'<div class="answers_line">\
				<div class="double_arrow">\
					<span> >> </span>\
				</div>\
				<div class="ans">\
					<pre class="blah"><span>' + equation_string + '</span><br></pre>'
        
        if (result.length > 0) {
						
			for (var ans = 0; ans < result.length; ans++) {
				answer_line += '<pre class="output">' + result[ans] + '</pre>'; 
			}

        }

		answer_line += '</div></div>';
			
		$('#answers').append(answer_line);
		
    
    } else { // The equation caused an error
        
        var highlighted_equation = equation_parts.slice();

            
        // determine if there are more multiple elements that need to be highlighted, the array defines which elements should be highlighted
        // they don't need to be in order nor next to each other
        if (error_parts instanceof Array) {
            
            // highlight the groupings of elements that occur sequentially next to each other
            for (var pos = 0; pos < error_parts.length; pos++) {
                var error_pos = error_parts[pos];
                // not_adjacent is true if the two elements are not adjacent
                var not_adjacent = error_pos - error_parts[pos-1] > 1;
                // Deal with the start or if the two elements aren't next to each other
                if (pos == 0 || not_adjacent == true) {
                    highlighted_equation[error_pos] = '<span class="highlight">' + highlighted_equation[error_pos];
                }
                
                // Deal with the end
                if (pos == error_parts.length-1) {
                    highlighted_equation[error_pos] += '</span>';
                }
                
                // Deal with the middle
                if (not_adjacent == true) {
                    highlighted_equation[error_parts[pos-1]] += '</span>';
                }
                
            }

        } else if (!isNaN(error_parts)) { // single element to highlight

            highlighted_equation[error_parts] = '<span class="highlight">' + highlighted_equation[error_parts] + '</span>';
            
        }
        
        
        highlighted_equation = highlighted_equation.join('');
        
        $('#answers').append('<div class="answers_line"><div class="double_arrow"><span> >> </span></div><div class="ans"><pre class="blah"><span>' + highlighted_equation + '</span><br></pre><p class="error_output">' + result + '</p></div></div>');      
    
    }


    
    if (equation_string.length > 0) {
        updateUserHistory(equation_string);
    }
    
    $('#text_in').val('');
    
    // Ensure the scroll bars are all the way to the bottom and all the way to the left
    $('#equation_area').scrollTop($('#equation_area').prop('scrollHeight'));
    $('#equation_area').scrollLeft(0);
    
    updateVariableList();
    display_user_history();
}




/*
 * Update variable list
 *
 * This function is called when a variable is added or removed from the list
 *
 * this function should only be called when a variable is added, modified or removed
*/
function updateVariableList() {

    // Clear all elements in the div variable_list
    $('#variable_list').empty();
    
    // Get a sorted list of user_variables keys
    // This isn't ideal as sort is being called everytime
    // Should maintain a sorted list which is updated when a variable is added or removed
    var variable_keys = Object.keys(user_variables).sort();
    
    
    console.log('keys = ' + variable_keys);
    // get the tags in variable list, sort them, go through this list getting the variables
    // and adding them to the variable_list div
    for (var i = 0; i < variable_keys.length; i++) {
        $('#variable_list').append('<p class="variable_line"> ' + variable_keys[i] + ' = ' + user_variables[variable_keys[i]] + '</p>');
    }
    
}

function display_user_history() {
    $('#command_history').empty();

    for (var i = user_history.length-1; i >= 0; i--) {
        $('#command_history').append('<p class="history_line"> ' + user_history[i] + '</p>');
    }
}


/* When the user presses the up key
 * and the equation_string is empty
 *     go to the previous entry
 *     display it
 *     increment the user_history_position
 *
 * and the equation_string is not empty
 *     check to see if there is a previous entry that partially matches the entered string
 *     display it
 *     update the user_history_position to the position of the partially matched string
 *
 * direction is the direction in which to search the user_history
 *     1 is up the user_history
 *    -1 is down the user_history
 *
 * To add or fix:
 * if the equation_string isn't in the history then do nothing
 * add down arrow interaction
 *
*/
function searchUserHistory_2(equation_string, direction) {
    
    // If equation_string doesn't match the current_equation_string
    // then the user has changed the textbox content
    // Note, this is the only location current_equation_string gets used
    // it gets set inside the while loop
    if (equation_string != current_equation_string) {
        // Reset the user history position to restart search
        // and set the initial_equation to the new equation_string
        user_history_position = 0;
        initial_equation_string = equation_string;
    }
    
    while (true) {
        
        // Move to the next item in the history array, based on arrow key direction
        // user_history.length + 1 allows the history to include equation string
        user_history_position = (user_history_position + direction) % (user_history.length + 1);
        
        // Reset the user_history_position to the appropriate position value
        if (user_history_position < 0) {
            user_history_position = user_history.length + user_history_position + 1;
        }

        
        // If user_history_position == 0 then we are back at the start
        if (user_history_position == 0) {
            //$('#text_in').val(  );
            current_equation_string = initial_equation_string;
            return initial_equation_string;
        }
        
        // Get the history element substring, if it matches the initial_equation_string,
        // that is, what the user initially entered, then update the equation_input
        // and exit
        // Otherwise repeat the loop.
        history_item = user_history[user_history_position-1];
        el = history_item.substring(0, initial_equation_string.length);

        // The user_history[user_history_position-1] != initial_equation_string
        // stops the search finding history items that are exactly the same as what has already been entered, remove this to find all history entries that start with
        // initial_equation_string
        // This could also be done as el.length != initial_equation_string.length
        if ( el === initial_equation_string && history_item != initial_equation_string) {
            current_equation_string = history_item;
            return history_item;
        }
    
    
    }


}

function updateUserHistory(equation_string) {
    user_history_position = 0;
    
    // Add equation to start of user_history
    user_history.unshift(equation_string);
    
    // Remove all history elements whose position in user_history is greater than the maximum allowable number of element defined by max_history_elements
    user_history.splice(max_history_elements, user_history.length - max_history_elements);

}
