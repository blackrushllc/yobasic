Todo Done:

In the notepad widget, the File->Open menu launches the file explorer but doesn't allow you to select a file, rather it has the default behavior of launching the selected file in the terminal.
Also in this context, you can right click the file and select "Open" but it will open in a new instance of Notepad, because this is also the default behavior of the file explorer.
The correct behavior is the open a new modal instance of the file explorer in a mode which allows you to select a file to open in the current instance of notepad.
When the new instance of the file explorer is opened from Notepad, it should be modal and also have the tool bar title of "Select a file to open"
When any other application opens the file explorer, it should be modal and also have the tool bar title of "Select a folder to open"
When the file explorer or any other future widget is "modal", then we should have a visual indication that a model is expecting input, such as changing the rest of the display to grey and white, or showing a partially opaque overlay that covers everything except the modal widget.

Double clicking on a .BAS file opens the terminal but the program doesn't run.

When a system dialog (such as alert()) is launched by a BASIC program, the "Cancel" option should terminate the program.

Delete icons from the desktop, and files from file explorer.

Add a "Rename" option to the context menu of the desktop and File Explorer.

Replace the "copy" option in the context menu of the File Explorer with "Duplicate" and prompt for a new file name.

Add options in the context menu to add a built-in widget or iframe widget.
When you add an iframe widget, prompt for the URL.

Add a "Close All" option to the context menu of the desktop.

Add a "Minimize All" option to the context menu of the desktop.
Drag a file from the file explorer onto the desktop to create a shortcut.

Wrap whole words in the titles of the desktop shortcuts.

The Help->About menu option doesn't do anything. I want it to do the same thing as the Help->About menu option in index.html.

Remember the position and size of the widgets that are on the desktop for when they are reopened.

Fix Icon arrangment. Sometimes 2 icons are overlapped. Detections are needed to prevent this. Whenever icons are drawn or an icon is moved. detect overlaps and rearrange by appending the overlapping icons to the end of the list.

Add a "Run" menu option and button to Notepad and the Tabbed Editor when a BASIC (.BAS, or .BASIL) program is in the editor.

Add a "Run Selection" option and button to Notepad when a BASIC program is opened and a selection is made.

List the built-in widgets in the context menu for "Add Built-in Widget".  The list should include all of the static default widgets placed on the desktop excluding the links:
These include, but are not limited to:
- Notepad
- Terminal
- File Explorer
- Chat
- Desktop
- Settings
- About

Also, right click on a desktop iframe widget and selecting "properties" should allow you to edit the URL.

"Reset Desktop" should reset the desktop to the default layout and remove all custom widgets that are not in the default layout.
Use a different icon for iframe widgets. Right now it's using the "link" icon.

Context menus do not clear after performing a function unless the user clicks somewhere else.
The context menus should clear after performing a function.

Opening repeated instances of notepad or the terminal should offset the location of the new instance slightly to the right and downward so that it doesn't overlap the previous instance.

In the desktop.html chat, add a small margin to the bottom of the chat window so that the user can see the bottom of the chat window because the "Type a message..." and the Send button are partially obscured.

Add an audible alert when a chat message is received.

Poll the chat server for new messages every 5 seconds in desktop.html chat when the chat window is open.

The "Delete" key in the desktop.html Notepad is being intercepted by the page, prompting the user to confirm that they want to delete whatever item has been selected on the desktop.
The expected behavior is that the "Delete" key should be used by the editor normally. This should also be fixed in the tabbed editor as well.

Opening a non-BASIC file in notepad or from the File Manager seems to display a blank document.
The expected behavior is that the file should be opened in the editor if it is an editable file type.
We will be adding support for opening non-editbale files in alternative viewers/players shortly.
A non-BASIC file in notepad should not have the Run or Run Selection options.

Add a "Reset Defaults" option to index.html under the "Help" navigation menu dropdown to clear all user settings and restore the default settings, but retain the user's files in the shared (supabase) file system if they exist, and any user profile information that might be saved locally.

The chat transcript in index.html is overruning the chat window.
The expected behavior is that the chat transcript should scroll down automatically as new messages are received.



In index.html, in the "Explorer" section, if I drill down into the "examples" folder and click on any file in that listing it will open in the tabbed editor, except for the 2 new examples UI_CLICK.BAS and UI_FORM.BAS.

In both desktop.html and index.html the "views" folder correctly displays and opens the example files counter.html and login.html

However, when resetting both pages to defaults, or opening both pages in a virgin browser, there is a marked descrepancy between the file listings in the examples folder.

index.html shows these files in /examples/:
DATADEMO.BAS
FORNEXT.BAS
HELLO.BAS
INPUTNAME.BAS
SELECTCASE.BAS
UI_CLICK.BAS
UI_FORM.BAS
WHILE.BAS

desktop.html "File Explorer" shows these files in /examples/:
DATADEMO.BAS
FORNEXT.BAS
HELLO.BAS
INPUTNAME.BAS
SELECTCASE.BAS
UI_CLICK.BAS
UI_FORM.BAS
WHILE.BAS

ARRAYS.BAS
COMMENTS.BAS
DATADEMO.BAS
FOREACH.BAS
FOREACH2.BAS
FORNEXT.BAS
FUNCTIONS.BAS
GOSUB.BAS
GOTO.BAS
HELLO.BAS
SELECTCASE.BAS
TRYCATCH.BAS
WHILE.BAS

Please analyze and explain why these pseudo-directories have different contents, and explain why I am inable to open the UI_CLICK.BAS and UI_FORM.BAS examples shown in the directory listing on the index.html file explorer section.

I see that we have a conflict between the example "files" that are hard coded into vfs.js and the listing that comes from the Supabase table "examples".

This is likely the cause of the problem because clicking on any file that has a corresponding record in Supabase will open the "file" stored in the Supabase table, however the  UI_CLICK.BAS and UI_FORM.BAS "files" are the only ones coded into vfs.js that do not have a corresponding copy in Supabase thus we have a conflict.

Please modify the default location of the hard coded examples to a new pseudo folder called "demo" and allow the entries from Supabase to be displayed in the user's "examples" pseudo folder.

Please make sure that the behavior of the index.html "Explorer" file area and the desktop.html "File Explorer" directory displays are both rendered using the same source data.

Also, when saving a file in index.html, if a file extension is provided then do not add ".BAS".  A problem occurs when I try to create a file with ".html" and we are currently saving it as ".html.BAS".  Only add ".BAS" if no other extension is given.

Finally, do not allow a file name to be saved with "\" as a directory seperator.  If "\" is included in a file name, then change it to "/"


When running UI_FORM.BAS in index.html and in desktop.html, the form displays correctly however when you hit the Login button with an invalid username and password, the whole page refreshes.
Also, if you remove the line: UI.CLOSE%(evt@["DIALOGID%"]) from the code, then a successful login also causes the page to refresh.

When running UI_CLICK.BAS in index.html, the "Increment" button successfully increments the counter, however it appears that the count% variable is not being incremented, or continues to be zero between runs, as though it is a local variable
This may be a systemic problem with the BASIC runtime,
```
   count% = 0
   dlg% = UI.SHOW%("views/counter.html", {}, {"title": "Counter Demo"})
   UI.ON%(dlg%, "click", "#incBtn", "Inc_Click")

   SUB Inc_Click(evt@)
     count% = count% + 1
     UI.SET_TEXT%(evt@["DIALOGID%"], "#countLabel", "Count: " + STR(count%))
   END SUB
```

In index.html, replace the "Help 1", "Help 2" and "Help 3" options with 3 menu items to the "Help" dropdown:
= "Desktop" - opens the desktop.html page in a new tab.
= "Minimal IDE" - opens the test.html page in a new tab.
= "Reference and Guide" - opens https://blackrushbasic.com/ in a new tab.

In desktop.html, add 3 new options to the "Help" dropdown:
= "YoBASIC IDE" - opens the index.html page in a new tab.
= "Minimal IDE" - opens the test.html page in a new tab.
= "Reference and Guide" - opens https://blackrushbasic.com/ in a new tab.
Add a single separator between the 3 new "Help" dropdown items and "About".


Todo Next:



Todo Later:




What is going on with the tabbed editor?  Everything seems to happen in just one tab right now.

Shared Projects doen't work.

Type "HELP" for guidance. - doesn't do anything lol

Add "CLS", "CLEAR", "TRON", "TROFF" and "MOD" to the BASIC language.

Watch Window system:

- Add a "Watch" button to the toolbar of Notepad when a BASIC program is opened, and open a simple watch window when the button is clicked showing a report of all defined variables and their values, as well as any changes to those variables during the program's execution.
- Add the "Watch" functionality to index.html as well, in the right hand pane where it says "Todo: variable watch and stack info will appear here."
- Show and auto-refresh the stack info in watch windows (for both desktop.html and index.html) as well.
- Allow the user to edit the value of a variable in the watch windows (for both desktop.html and index.html).

Additional Widgets for opening certain file types (not just .BAS files, not on destkop or in Built-in Widget list):

- Display an appropriate icon for the file type.
- Add a video player widget that can play videos from the File Manager or desktop shortcuts.
- Add a audio player widget that can play sound files from the File Manager or desktop shortcuts.
- Add a rich text editor widget that can edit text files from the File Manager or desktop shortcuts.

Enhancements to Notepad and Tabbed Editor:

Add a "Share in Chat" button to Notepad for selected text.



Downloading a basil file is trying to execute it. :thinking face:

Funky stuff:

Add a "graphics mode" aspect to basic.js using an add-on system.

Add a "Webcam" library

Add a "Speech Recognition" library

Add a "Speech Synthesis" library

Add an AI library

Add a "QR Code Scanner" library

Add a "Barcode Scanner" library

Add a "Bluetooth" library

Add a "Bluetooth Low Energy" library

Add a "WebRTC" library

Add a "WebAssembly" library

Add a "WebGL" library





