index.html is an IDE for basic.js with lots of bells and whistles on the page. It also includes a terminal for hosting
an interactive basic.js command prompt, and a tabbed editor system for loading and running BASIC programs.

I need to do some interactive testing with basic.js so I would like to have a very minimal implementation of this IDE
that contains only one instance of the code editor and one instance of the terminal containing an instance of the
basic.js interpreter.

Create a new page called test.html with a minimal IDE.

I want to have this minimal IDE have only the following features from index.html:

- A single instance of the code editor.
- A single instance of the BASIC terminal.
- The "Run" and "Run Selection" buttons with F9/F8 keyboard shortcuts.
- The Tron/Troff button to turn on and of debug mode in the terminal/BASIC interpreter.

Split the screen vertically with the top half containing a row for the buttons and the code editor, and the bottom half
containing an instance of the terminal.

Fix all screen elements to the viewport size with no overflow or vertical expansion of the page.

Do not include the miniature toolbar that we currently have to reposition the terminal. The terminal will always be
fixed to the bottom half of the page.

The goal is for you and me to easily test and debug the process of code execution and the functionality within basic.js
in order to rectify some bugs in basic.js and also to easily add and test changes to basic.js.

index.html also has the ability to provide syntax highlighting and other settings to the code editor via calls to
basic.js and I want to keep this functionality in test.html as well, so we can also debug or enhance that part of the
system too.

Keep all styles to the bare minimum, black and white, unless necessary for proper presentation of the screen elements
such as syntax highlighting in the code editor.

Use the same color schemes for both the code editor and terminal currently being used in index.html in order to best
approximate the appearance of these elements while testing.