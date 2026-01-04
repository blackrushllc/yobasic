# Lesson Plans

## TUTORIAL PAGE 001 - Hello World and the Basics

### Introduction Video
- KALA_FUNDAMENTAL: In this tutorial we are going to learn the fundamental concepts of programming with YoBASIC. 
- We are going to write simple applications the demonstrate the core concepts of programming.  
- By the end of this tutorial you are going to have a general understanding how how to write code in any programming language.
### Example 1 - Hello World
```
print "Hello from YoBASIC"
```
#### Listen: This first example is what we call the "Hello World" program.
- Whenever any programmer starts learning a new programming language, the first program they write is usually the "Hello World" program.
- It is a simple program that prints the text "Hello World" to the screen.
- Everyone does this, just to make sure that their programming language is working properly.
- To start, click the button to open our first example in an editor tab. Click the button that says "Open in YoBASIC Editor".
- You will see a new editor tab open with the code for the first example.
- Then, do 2 things. Click the yellow "Tron/Troff" button to turn off the "Tron" mode. This is a toggle button you can 
  - use to turn on or off extra messages in the terminal that can help you debug your program. We don't need this on.
- After that, click the green "Clear" button or type the command "clear" in your terminal to clear the screen.
- Finally, click the "Run" button or press F9 to run the program. You will see the text "Hello from YoBASIC" printed to the terminal screen.
- Now do this, change the text inside the quotes to say "Hello World" or something else instead of "Hello from YoBASIC". 
  - Then run the program again.
- You should see the new text printed to the screen.
- Now move on to the next example.
### Example 2 – Variables and Input
```
// Run this example to see how variables and input work in YoBASIC

A$ = "Hello"
B$ = " from YoBASIC"
print A$ + B$

INPUT "What is your name? ", B$
print A$ + B$

// Try changing the value of B$ and running the program again.

// Try selecting just the last line of the program and running it alone with F8

```
#### Listen: Variables and Input...
- To start, click the button to open our first example in an editor tab. Click the button that says "Open in YoBASIC Editor".
- You will see a new editor tab open with the code for this example.
- Let's talk about variables. A variable is a place in memory where you can store data.
- In YoBASIC, a variable that ends with a dollar sign ($) is a string variable, which means it can store text.
- Variables can be any name you want, but it is conventional to use all-caps letters and underscores to separate words in variable names.
- In this example, we are creating 2 variables: we call them A$ and B$. We say "String" when we see the dollar signe, 
  - which helps to let us know that these variables are intended to hold strings of text and not something else like numbers or lists
- Notice the first and last couple of lines that start with "//". These are comments. 
- Comments are lines that you can add to your program to explain what the code is doing. They are not executed by YoBASIC.
- Slash-Slash is a common watershed comment symbol in most programming languages. YoBASIC also gives you other ways to add comments.
- The first line of actual code assigns the value "Hello" to the variable A$.
- The second line assigns the value " from YoBASIC" to the variable B$.
- The third line prints the value of A$ plus B$.  When you plus together strings, it means to join them together.
- The fourth line of actual code prompts the user to enter their name in a pop up box and assigns the user's input to the 
  - variable B$, no matter what they typed.
- The fifth line prints the text A$ plus B$ again, this time using the value of B$ instead of the literal string " from YoBASIC".
- Now here's an extra assignment. Use you mouse to only select the last line of the program and run it with F8. Hit F8 again and again to see what happens.
### Example 3 – Decision Making with IF
```
REM Print a message if the user's number is less than 5, equal to 5, or greater than 5

INPUT "Enter a number from 1 to 10? ", number%
IF number% < 5 THEN print "The number is less than 5"
IF number% = 5 THEN print "The number is equal to 5"
IF number% > 5 THEN print "The number is greater than 5"
```
####  Listen: Decision Making with IF...
- To start, click the button to open our first example in an editor tab. Click the button that says "Open in YoBASIC Editor".
- You will see a new editor tab open with the code for this example.
- Sometimes you will want your program to make a decision based on some condition. That's one of the main things we use computers for, after all!
- In YoBASIC, we use the IF statement to make decisions.
- The first line of the program prompts the user to enter a number from 1 to 10.
- The second line uses the IF statement to check if the number entered by the user is less than 5.
- If it is, the program prints the message "The number is less than 5".
- The third line uses the IF statement to check if the number entered by the user is equal to 5.
- If it is, the program prints the message "The number is equal to 5".
- The fourth line uses the IF statement to check if the number entered by the user is greater than 5.
- If it is, the program prints the message "The number is greater than 5".
- We can use IF a lot of different ways, and you'll learn more about them in the next section.
### Example 4 – Loops with FOR/NEXT
```
REM Print the squares of numbers 1 through 10

FOR i = 1 TO 10
  PRINT i, " squared is ", i * i
NEXT i
```
####  Listen: Loops with FOR/NEXT...
- To start, click the button to open our first example in an editor tab. Click the button that says "Open in YoBASIC Editor".
- You will see a new editor tab open with the code for this example.
- Sometimes you will want your program to repeat a block of code multiple times. That's where loops come in.
- In YoBASIC, we use the FOR/NEXT loop to repeat a block of code a specific number of times.
- The first line of the program starts the FOR loop. It creates a variable called i and sets it to 1. 
- The loop will continue as long as i is less than or equal to 10.
- The second line prints the value of i, the text " squared is ", and the square of i (which is i multiplied by itself).
- The third line ends the FOR loop and increments the value of i by 1.
- The loop will repeat until i is greater than 10.
- We have lots of other ways we can do loops, and you'll learn more about them as we go through the lessons.
###  Recap Video (Todo: Kala)
- In this lesson we learned the basics of programming with YoBASIC.
- We wrote our first program, the "Hello World" program, which prints text to the screen.
- We also learned about variables and input, decision making with "if" statements, and loops with "For" and "Next".
- These are the fundamental concepts of programming that you will use in every programming language.
- In the next lesson, we will dive deeper into variables and functions. See you there!

- I den här lektionen lärde vi oss grunderna i programmering med YoBASIC.
- Vi skrev vårt första program, programmet "Hello World", som skriver ut text på skärmen.
- Vi lärde oss också om variabler och indata, beslutsfattande med "if"-satser och loopar med "For" och "Next".
- Det här är de grundläggande programmeringsbegreppen som du kommer att använda i alla programmeringsspråk.
- I nästa lektion kommer vi att fördjupa oss i variabler och funktioner. Vi ses där!
---

## TUTORIAL PAGE 002 - Variables and Functions

### Introduction Video (Todo Skye)
- In this tutorial we are going to learn about variables and functions in YoBASIC.
- Variables are used to store data in your program, and functions are used to group code together to perform a specific task.
- By the end of this tutorial you will understand how variables and functions are used together in most programming languages.
### Example 1 - Using a very simple function, or "CALLING"
```
// Create a function called PRINTME
FUNCTION PRINTME()
  print "------------------"
  print "Hello from YoBASIC"
  print "------------------"
END FUNCTION

// Then run the function
PRINTME()

```
####  Listen: 
- To use a function, we must first create it.  After we create a function, we then call it by name whenever we want to use it.
- In this example, we are calling the function PRINTME, which prints text to the screen in between lines of dashes.
### Example 2 – Sending a variable to a function
```
// Create a function called PRINTME that takes a string variable as a parameter
FUNCTION PRINTME(TextToPrint$)
  print "------------------"
  print TextToPrint$
  print "------------------"
END FUNCTION

// Then run the function with a different string each time
A$ = "Hello from YoBASIC"
PRINTME(A$)

B$ = "I can reuse functions!"
PRINTME(B$)
```
####  Listen: Blah...
### Example 3 – Another function example with multiple parameters
```
// Create a function called PRINTME that takes a two string variables as a parameters
FUNCTION PRINTME(TextToPrint$, LinesToPrint$)
  print LinesToPrint$
  print TextToPrint$
  print LinesToPrint$
END FUNCTION

// Then run the function with a different string each time
A$ = "Hello from YoBASIC"
PRINTME(A$, "------------------")

B$ = "I can reuse functions!"
PRINTME(B$, "====")
```
####  Listen: Blah...
### Example 4 – A function that can call itself!
```
// Create a function called fib() that calculates 

FUNCTION fib%(n%)
    IF n% < 2 THEN 
        rVal% =  n%
    ELSE    
        rVal% =   fib%(n% - 1) + fib%(n% - 2)
    END IF   
    RETURN rVal%
END FUNCTION

PRINT fib%(10); // 55

TODO: ERROR!!!! - ALSO RETURN inside IF/END IF block errors with a different error

[BASIC] Run Program
[BASIC ERROR] RETURN without GOSUB at line 9
[BASIC] End Run Program
RETURN without GOSUB at line 9


```
####  Listen: Blah...
###  Recap Video  (Todo Skye)
- In this tutorial we learned about variables and functions in YoBASIC.
- We learned how to create functions, call them, and pass variables to them as parameters.
- We also learned about recursion, which is when a function calls itself.
- These concepts are fundamental to programming and are used in most programming languages.
- In the next tutorial, we will learn about loops and how to use them in YoBASIC. See you there!
---

## TUTORIAL PAGE 003 - Loops

### Introduction Video (Todo: Tiffany)
- Hi! In this tutorial we are going to learn about creating different kinds of "loops", which are used to repeat a block of code multiple times.
- All programming languages have different ways to create loops, but they all follow the same basic structure.
- Loops are important because they allow us to automate repetitive tasks and process large amounts of data efficiently, or to run a continuous workflow, such as a video game, until certain conditions are met.
- For example, a video game loop might pause when you open up an inventory screen, and then exit when you quit the game or get your self killed.
- A loop on a website might check for new posts every few seconds, and then display them on the screen until you close the browser window.
- By the end of this tutorial you will have a basic understanding of different kinds of loops.
  
### Example 1 - Looping with GOTO 
```
start:
  print "Hello from YoBASIC"
  INPUT "Do you want to see this again? (Y/N) ", answer$
  IF answer$ = "Y" OR answer$ = "y" THEN GOTO start
```
####  Listen: Hello World...
### Example 2 – Looping with GOSUB
```
start:
    print "Hello from YoBASIC"
    INPUT "Do you want to see the time and date? (Y/N/Q) ", answer$
    IF answer$ = "Y" OR answer$ = "y" THEN GOSUB time_and_date
    IF answer$ = "Q" OR answer$ = "q" THEN END
    PRINT "You pressed ", answer$
    GOTO start
    
time_and_date:
    print "The current date and time is: ", DATE$ + " " + TIME$
    RETURN
```
####  Listen: Blah...
### Example 3 – Looping with WHILE/END WHILE
```
print "Hello from YoBASIC"
counter% = 1
WHILE counter% <= 5
  print "This is loop iteration number "; counter%
  counter% = counter% + 1
END WHILE
```
####  Listen: Blah...
### Example 4 – Loopingn with FOR/NEXT
```
print "Hello from YoBASIC"
FOR i = 1 TO 5
  print "This is loop iteration number ", i
NEXT i
```
####  Listen: Lesson Recap

###  Recap Video  (Todo: Tiffany)
- In this tutorial we learned about loops in YoBASIC.
- We learned how to use GOTO and GOSUB to create loops, as well as WHILE/END WHILE and FOR/NEXT loops.
- While most programming languages no longer use GOTO, "For Loops" and "While Loops" are extremely common in most languages.
- Loops are an essential part of programming and are used to automate repetitive tasks and process large amounts of data efficiently.
- In the next tutorial, we will learn about arrays, lists, and dictionaries. See you there!
---

## TUTORIAL PAGE 004 - Arrays, Lists, and Dictionaries

### Introduction Video Todo: Kala
- Things are starting to get interesting now! We're going to learn about arrays, lists and dictionaries in YoBASIC.
- These are data structures that allow us to store and organize multiple values in a single variable, and they are essential for handling complex data in our programs.
- By combining loops, logic and functions with arrays, lists and dictionaries, we can create powerful and efficient programs.
- By the end of this tutorial you will understand how to use arrays, lists and dictionaries
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video Todo: Kala
- In this tutorial we learned about arrays, lists, and dictionaries in YoBASIC.
- We learned how to create arrays, lists, and dictionaries, and how to use them to store and organize data.
- These data structures are essential for handling complex data in our programs.
- In the next tutorial, we will learn about classes and objects.
---

## TUTORIAL PAGE 005 - Classes and Objects

### Introduction Video
- Objects are like arrays, lists and dictionaries, but they are more powerful and flexible because they can also contain functions and code.
- Objects allow us to create complex data structures that can represent real-world entities and behaviors.
- Classes are like blueprints for creating objects. They define the code and data that an object will have.
- Classes and Objects are a fundamental concept in object-oriented programming (OOP), which is a popular programming paradigm used in many modern programming languages.
- Classes and Objects are especially cool because you can create reusable code that can be shared and extended across different programs.
- By the end of this tutorial you will understand how to create classes and use objects in YoBASIC
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video 
- In this tutorial we learned about classes and objects in YoBASIC.
- We learned how to create classes, which are like blueprints for creating objects.
- We learned how to use objects, which are reusable components that can be used to build web pages.
- In the next tutorial, we will learn about how to store data in YoBASIC.
---

## TUTORIAL PAGE 006 - Web Pages

### Introduction Video
- In this tutorial we are going to learn about how to create web pages with YoBASIC.
- YoBASIC has built-in support for creating web pages and web applications, which makes it easy to build dynamic and interactive web content.
- We will also learn how to create "Views" in YoBASIC, which are reusable components that can be used to build web pages.
- By the end of this tutorial you will understand how to create web pages and views in YoBASIC.
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video 
- In this tutorial we learned about how to create web pages with YoBASIC.
- We learned how to create views, which are reusable components that can be used to build web pages.
- We also learned how to use YoBASIC's web server to host and share web pages online.
- In the next tutorial, we will learn about how to store data in YoBASIC.
---

## TUTORIAL PAGE 007 -  Storing Data

### Introduction Video
- In this tutorial we are going to learn about how to store data in YoBASIC.
- YoBASIC provides several ways to store data, including files, databases, and cloud storage.
- YoBASIC has built-in support for storing data in databases, which makes it easy to create applications that can save and retrieve data.
- We will also learn how to use SQL (Structured Query Language) to interact with databases and perform operations like creating tables, inserting data, and querying data.
- By the end of this tutorial you will understand how to store and retrieve data in YoBASIC.
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video 
- In this tutorial we learned about how to store data in YoBASIC.
- We learned how to use YoBASIC's built-in database to store and retrieve data.
- We also learned how to use SQL to interact with databases and perform operations like creating tables, inserting data, and querying data.
- In the next tutorial, we will learn about how to share your work in a web page.
---

## TUTORIAL PAGE 008 - Sharing your Work in a Web Page

### Introduction Video

```
FYI we made this video already, maybe we can use that between 008 and 008b (008a?):
KALA_MAKE_WEBSITE_DOWNLOAD_BASIL: In this tutorial we are going to generate a sample website that you can on your 
browse on your local computer. Click on the link below to download and install Basil, and then come back here for chapter two.
```

- In this tutorial we are going to create a sharable web page in YoBASIC.
- YoBASIC makes it easy to share your web pages with others by providing built-in support for hosting and sharing web pages online.
- We will learn how to create a web page, publish it online, and share it with others.
- By the end of this tutorial you will understand how to share your web page in YoBASIC.
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video 
- In this tutorial we learned about how to share your work in a web page.
- We learned how to use YoBASIC's web server to host and share web pages online.
- In the next tutorial, we will learn about creating and sharing a web application.
---

## TUTORIAL PAGE 008b - Projects - Creating and Sharing a Web Application

### Introduction Video
- KALA_CREATE_WEBAPP_SHARE_PUBLISH_SHARE: In this tutorial we are going to use YoBASIC to create a web application 
- that you can share with your friends.  We will build on the basics that we've learned so far to create a web 
- project that does something useful, and then publish and share your work online!
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video
- In this tutorial we learned about creating and sharing a web application.
- We learned how to use YoBASIC's web server to host and share web pages online.
- In the next tutorial, we will learn about handling errors in YoBASIC.
---

## TUTORIAL PAGE 009 - Exceptions

### Introduction Video
- Error! In this tutorial we are going to learn about exceptions in YoBASIC.
- Exceptions are used to handle errors and unexpected situations in your programs.
- By using exceptions, you can make your programs more robust and reliable.
- We will learn how to use try/catch blocks to handle exceptions and perform error handling
- By the end of this tutorial you will understand how to use exceptions in YoBASIC.
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video 
- In this tutorial we learned about exceptions in YoBASIC.
- We learned how to use try/catch blocks to handle exceptions and perform error handling.
- In the next tutorial, we are going to take a look at Basil, a programming language that makes it easy to create websites and applications.
- Basil is a programming language that is designed to be easy to learn and use, but powerful enough to create complex applications and large scale websites.
- Now that you have a basic understanding of YoBASIC, you've already learned everything you need to get started and create real world solutions with Basil! 
---

## TUTORIAL PAGE 010 - Advanced Topics - Basil Part 1
### Introduction Video
- "Blah..."
### Example 1 - Blah
```
print "Hello from YoBASIC"
```
####  Listen: Hello World...
### Example 2 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 3 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
### Example 4 – Blah
```
print "Hello from YoBASIC"
```
####  Listen: Blah...
###  Recap Video 

---

## TUTORIAL PAGE 011 - Advanced Topics - Basil Part 2


---

## TUTORIAL PAGE 012 - Advanced Topics - Basil Part 3


---

## TUTORIAL PAGE 013 - Advanced Topics - Hello Worlds
- Python
- Javascript
- cplusplus
- BASH
- Php
- Java


Strip Tease Symphony
https://open.spotify.com/track/4gWeQcvByJuzXSs4KkghBI?si=315c736cc01d4ae4

Anyway
https://open.spotify.com/track/7Hsc7e9eU7s3GwmgUVFBrC?si=0877fd2ea20a4b54

Hello
https://open.spotify.com/track/47nze8Xq8QyvhTqir4aoM6?si=eecf41e03a5d4979

Mystical Adventures
https://open.spotify.com/track/0zu0m5KevlDNU3Uk7HdU7g?si=e92be1a3599d4205

As
https://open.spotify.com/track/2TN3KmfLKlnUPDpIQPUNrp?si=5fe5cd00865b4a31

Jig
https://open.spotify.com/track/3m2k89eVZpA4GOogDNXHKx?si=cdda79031f80405f

Flight over Rio
https://open.spotify.com/track/2BiueR07VGUbxGTjp9q9fA?si=0f8d16b3bb994fc0

Midnight Tango
https://open.spotify.com/track/2ZjGc10SrEJsghK8iTOqK6?si=632aa2f6262145d9

Mediterranean Sundance
https://open.spotify.com/track/7lflARLzeb71KjdYPU7CFt?si=df8e4764ccc647e2

Race With Devil On Spanish Highway
https://open.spotify.com/track/1qPSxRyMfES52PbpxCzWcd?si=4952244d5d13471b

Lady of Rome, Sister of Brazil
https://open.spotify.com/track/3JIUGcYAFgwtjWy0DClmx3?si=ef8bed4969fe43d8

Elegant Gypsy Suite
https://open.spotify.com/track/5d1bISuOdjVc5ThkmNHOIP?si=4b1ce10fc9af4a96

Carlos Primero
https://open.spotify.com/track/0Ktu27rkXVCt07e5kw3Mtp?si=8db9d44f51224314

Rearranging Furniture
https://open.spotify.com/track/3HRqtrUKxbPgE1dqpZT1vb?si=1f33dd8d22174000

Svyryd - Beduin Rework
https://open.spotify.com/track/4MiehqrnVBCtOHU94Id6TT?si=936bb6e648db4610

A Doschyk Nakrapate - Beduin Rework
https://open.spotify.com/track/0RN1tsVNhDyxLhGtLwBVEA?si=6a05e5a373ff4e08

Union Federal
https://open.spotify.com/track/6eejZDTHCw7bBb1ZT8UI0P?si=c7e0043cf7074b76

It's Ice
https://open.spotify.com/track/2EtxqjLs4wSBTNtkm5VqkE?si=b8085c27603d40c1

Metallic Rain
https://open.spotify.com/track/04JlHsrYsWIjL6YzJBktHN?si=8431bd9316e945cf

La petite Fille de la mer
https://open.spotify.com/track/3uNFRvQVEIEsQgHdZFw6Dk?si=e7e427c8efd24029

Super Hexacordium
https://open.spotify.com/track/0eCVcOv8pHrFjkdSMW5OhW?si=08b96a1786d64d3f

Lunar Pond
https://open.spotify.com/track/0xufJ8mQSnhvDyqnAueCUr?si=06bd788b2b0545cf

Union Federal
https://open.spotify.com/track/6eejZDTHCw7bBb1ZT8UI0P?si=d2d1c70df2e6438e

Things to Build
- Run Forest (Backend script hosting)
- IsHoliday API
 
