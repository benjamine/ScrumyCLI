Scrumy CLI
==============

**Command line interface for simple batch tasks on http://scrumy.com boards.**

Scrumy.com is a website that offers online scrum boards (sprint backlogs).
I'm not related to scrumy.com, I wrote this tool simplify some batch tasks we do on CI:
 - Add a "Test" task to each story
 - After a successfull build to QA, nark "Test" tasks in the verify column as "QA" (using scrumer name)

ScrumyCLI could be used for:

 - Querying the current sprint (filtering by story title, task title, state or scrumer)
 - Perform some batch changes on the filtered results:
   - Add a task to each story
   - Set task scrumer
   - Set task state
   - Add text to task title
   - Remove task

Note: ScrumyCLI uses scrumy.com REST API, which at the moment of this writing, doesn't support realtime notifications, so after doing modifications to your current sprint with this tool, you have to Refresh to see them on your browser.

## Requirements

 - NodeJS 0.6+ (with npm)
 - In order to access the scrumy.com REST API you need to register a PRO Project board on http://scrumy.com

## Installation

    git clone git@github.com:benjamine/ScrumyCLI.git
    npm install

## Usage

For instructions run:

    scrumycli --help

Note: scrumy password can be specified as a command argument, otherwise it will be prompted on the command line.

## License

(The MIT License)

Copyright (c) 2012 Benjamín Eidelman &lt;beneidel@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
