#!/usr/bin/env node
var program = require('commander');
var request = require('request');
var fs = require('fs');

program
  .version('0.0.1')
  .option('-b, --board <name>', 'Scrumy board name')
  .option('-p, --pwd <password>', 'Password')
  .option('-v, --verbose', 'Print debug info')
  .option('-o, --output <filename>', 'Send output to a file')
  
  // filters
  .option('-e, --empty', 'include stories without tasks (after filters)')
  .option('-E, --onlyempty', 'include only stories without tasks (after filters)')
  .option('-s, --state <state>', 'Filter tasks by state (todo|inprogress|verify|done)')
  .option('-S, --scrumer <scrumername>', 'Filter tasks by scrumer name (regex, case insensitive)')
  .option('-t, --title <tasktitle>', 'Filter tasks by title (regex, case insensitive)')
  .option('-T, --storytitle <storytitle>', 'Filter stories by title (regex, case insensitive)')
  
  // actions
  .option('-a, --addtask <tasktitle>', 'Add a task to filtered stories')
  .option('--addtotitle <text>', 'Add text to filtered tasks titles')
  .option('--addtaskscrumer <scrumername>', 'Scrumer for added tasks')
  .option('--addtaskstate <state>', 'State for added tasks')
  .option('--setstate <state>', 'Set state of filtered tasks')
  .option('--setscrumer <scrumername>', 'Set scrumer of filtered tasks')
  .option('-r, --remove', 'Remove filtered tasks')
  .parse(process.argv);

var log = function(message){
	console.log(message);
	if (program.output){
		fmsg = message.toString().replace(/\r\n|\r/g, '\n');
		var fd = fs.openSync(program.output, 'a+', 0666);
		fs.writeSync(fd, fmsg + '\n');
		fs.closeSync(fd);
	}
}

if (program.output){
	try {
		fs.unlinkSync(program.output);
	} catch(err){
	}
}

var board = program.board;
if (!board){
	log('no scrumy board specified, try --help');
	return;
}
var pwd = program.pwd;

var states = {
	todo: {
		index: 0,
	},
	inprogress: {
		index: 1,
	},
	verify: {
		index: 2,
	},
	done: {
		index: 3,
	}
}

var loadCurrentSprint = function(){
	var basicAuth = new Buffer(board+':'+pwd).toString('base64');
	var currenturl = 'https://scrumy.com/api/scrumies/' + board + '/sprints/current.json';
	console.log('connecting...\n');
	request({
			url: currenturl,  
			headers: {
				Origin: 'http://localhost',
				Authorization: 'Basic '+basicAuth
			}
		}, function (error, response, body) {

			if (program.verbose){
				log({ error: error, response: response, body: body});
			}
		
			if (error || response.statusCode != 200) {
				log('error loading current sprint: '+(error || response.statusCode));
				return;
			}
		
			var data = null;
			try {
				data = JSON.parse(body);	
			} catch (err) {
				log('error parsing data:'+err);
				log('DATA:');
				log(body);
				return;
			}

			if (!data.sprint) {
				log('error loading current sprint: no data obtained');
				log('DATA:');
				log(body);
				return;
			}

			var changes = [];
			var sprint = data.sprint;
			log('# '+board.toUpperCase()+ '#\n');
			if (!sprint.stories || sprint.stories.length == 0) {
				// no stories
				log('(0 stories on current sprint)\n');
			}
			else {
				log('('+ sprint.stories.length + ' stories on current sprint)\n');
				var storiesfiltered = 0;
				log('## Stories ##\n');
				for (var i = 0; i < sprint.stories.length; i++) {
					var story = sprint.stories[i].story;
					
					if (program.storytitle && !new RegExp(program.storytitle,'i').test(story.title)) {
						continue;
					}
					
					var tasks = [];
					if (story.tasks) {
						for (var j = 0; j < story.tasks.length; j++) {
							var task = story.tasks[j].task;
							if (program.state && program.state !== task.state){
								continue;
							}
							task.scrumer_name = task.scrumer ? task.scrumer.name : ''; 
							if (program.scrumer && !new RegExp(program.scrumer,'i').test(task.scrumer_name)) {
								continue;
							}
							if (program.title && !new RegExp(program.title,'i').test(task.title)) {
								continue;
							}
							tasks.push(task);
						}
					}

					if (tasks.length < 1 && !program.empty && !program.onlyempty) {
						continue;
					} 
					if (tasks.length > 0 && program.onlyempty) {
						continue;
					} 
					
					log(' - '+story.title);
					
					story.tasks.sort(function(a,b){
						try {
							var stateDiff = states[a.task.state].index - states[b.task.state].index;
							if (stateDiff !== 0){
								return stateDiff;
							}
						} catch(err){
							log('error parsing task states: '+a.task.state+', '+b.task.state);
						}
						return a.task.seq - b.task.seq;
					});

					for (var j = 0; j < tasks.length; j++) {
						var task = tasks[j];
						log('  - ['+task.state+'] '+task.title + (task.scrumer ? ' => '+task.scrumer.name+'' : ''));
						var taskChanges = [];
						if (program.setscrumer || program.addtotitle || program.setstate){
							var taskData = {};
							if (program.setscrumer && task.scrumer.name !== program.setscrumer){
								taskData.scrumer_name = program.setscrumer;
								taskChanges.push('assigned to '+taskData.scrumer_name);
							}
							if (program.setstate && task.state !== program.setstate){
								taskData.state = program.setstate;
								taskChanges.push('moved to '+taskData.state);
							}
							if (program.addtotitle){
								taskData.title = task.title + program.addtotitle;
								taskChanges.push('added "'+program.addtotitle+'" to title');
							}
							if (taskChanges.length > 0){
								changes.push({
									description: 'task "'+task.title+'" '+taskChanges.join(', '),
									url: 'https://scrumy.com/api/tasks/' + task.id + '.json',
									method: 'PUT',
									data: taskData
								});
							}
						}else if (program.remove){
							changes.push({
								description: 'removed task: '+task.title,
								url: 'https://scrumy.com/api/tasks/' + task.id + '.json',
								method: 'DELETE'
							});
						}
						
					}
					
					storiesfiltered++;
					
					if (program.addtask){
						var taskData = { title: program.addtask };
						if (program.addtaskscrumer){
							taskData.scrumer_name = program.addtaskscrumer;
						}
						if (program.addtaskstate){
							taskData.state = program.addtaskstate;
						}
						changes.push({
							description: 'added task to: '+story.title,
							url: 'https://scrumy.com/api/stories/' + story.id + '/tasks',
							method: 'POST',
							data: taskData
						});
					}	
				}
				
				if (storiesfiltered === 0){
					log('  (empty)');
				}				
			}
			
			
			if (changes.length > 0){
				log('\nSaving changes...\n');
				var changeindex = 0;
				var saveNextChange = function(){
					if (changeindex >= changes.length){
						log('  '+changes.length+' change'+(changes.length===1?'':'s')+' saved');
						return;
					}
					var change = changes[changeindex];
					if (program.verbose){
						log(change);
					}
					request({ 
						url: change.url, 
						method: change.method, 
						headers: {
							Origin: 'http://localhost',
							Authorization: 'Basic '+basicAuth
						},
						json: change.data}, function(e,r,body){
						if (program.verbose){
							log({ error: e, response: r, body: body});
						}
						if (!error && r.statusCode < 300) {
							log(' - '+change.description+' => '+r.statusCode + ' OK');
							changeindex++;
							saveNextChange();
						} else {
							log('  Error trying to complete: '+change.description);
							log('  Error: '+(e || 'status '+r.statusCode));
							log('  Cancelled remaining '+(changes.length-changeindex)+' changes');
							process.exit(1);
						}
					});				
				}
				saveNextChange();
			}
		});
}

if (!pwd){
	program.password('Password: ', '*', function(pass){
		pwd = pass;
		process.stdin.destroy();
		loadCurrentSprint();
	});
} else {
	loadCurrentSprint();
}
