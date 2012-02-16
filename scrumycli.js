#!/usr/bin/env node
var program = require('commander');
var request = require('request');

program
  .version('0.0.1')
  .option('-b, --board <name>', 'Scrumy board name')
  .option('-p, --pwd <password>', 'Password')
  .option('-v, --verbose', 'Print debug info')
  
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

var board = program.board;
if (!board){
	throw new Error('no scrumy board specified');
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
	console.log('connecting...');
	request({
			url: currenturl,  
			headers: {
				Origin: 'http://localhost',
				Authorization: 'Basic '+basicAuth
			}
		}, function (error, response, body) {

			if (program.verbose){
				console.log({ error: error, response: response, body: body});
			}
		
			if (error || response.statusCode != 200) {
				console.log('error loading current sprint: '+(error || response.statusCode));
				return;
			}
		
			var data = null;
			try {
				data = JSON.parse(body);	
			} catch (err) {
				console.log('error parsing data:'+err);
				console.log('DATA:');
				console.log(body);
				return;
			}

			if (!data.sprint) {
				console.log('error loading current sprint: no data obtained');
				console.log('DATA:');
				console.log(body);
				return;
			}

			var changes = [];
			var sprint = data.sprint;
			if (!sprint.stories || sprint.stories.length == 0) {
				// no stories
				console.log('no stories found on current sprint');
			}
			else {
				console.log(sprint.stories.length + ' stories found on current sprint');
				var storiesfiltered = 0;
				console.log('== Stories ==');
				for (var i = 0; i < sprint.stories.length; i++) {
					var story = sprint.stories[i].story;
					
					if (program.storytitle && !new RegExp(program.storytitle,'i').test(story.title)) {
						continue;
					}
					
					var tasks = [];

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

					if (tasks.length < 1 && !program.empty && !program.onlyempty) {
						continue;
					} 
					if (tasks.length > 0 && program.onlyempty) {
						continue;
					} 
					
					console.log('  '+story.title);
					
					story.tasks.sort(function(a,b){
						try {
							var stateDiff = states[a.task.state].index - states[b.task.state].index;
							if (stateDiff !== 0){
								return stateDiff;
							}
						} catch(err){
							console.log('error parsing task states: '+a.task.state+', '+b.task.state);
						}
						return a.task.seq - b.task.seq;
					});

					for (var j = 0; j < tasks.length; j++) {
						var task = tasks[j];
						console.log('      ['+task.state+'] '+task.title + (task.scrumer ? ' =>'+task.scrumer.name+'' : ''));
						
						if (program.setscrumer || program.addtotitle || program.setstate){
							var taskData = {};
							if (program.setscrumer){
								taskData.scrumer_name = program.setscrumer;
							}
							if (program.setstate){
								taskData.state = program.setstate;
							}
							if (program.addtotitle){
								taskData.title = task.title + program.addtotitle;
							}
							changes.push({
								description: 'modified task: '+task.title,
								url: 'https://scrumy.com/api/tasks/' + task.id + '.json',
								method: 'PUT',
								data: taskData
							});
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
					console.log('  no stories');
				}				
			}
			
			
			if (changes.length > 0){
				console.log('Saving changes...');
				var changeindex = 0;
				var saveNextChange = function(){
					if (changeindex >= changes.length){
						console.log('  '+changes.length+' change'+(changes.length===1?'':'s')+' saved');
						return;
					}
					var change = changes[changeindex];
					if (program.verbose){
						console.log(change);
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
							console.log({ error: e, response: r, body: body});
						}
						if (!error && r.statusCode < 300) {
							console.log('  '+change.description+' => '+r.statusCode);
							changeindex++;
							saveNextChange();
						} else {
							console.log('  Error trying to complete: '+change.description);
							console.log('  Error: '+(e || 'status '+r.statusCode));
							console.log('  Cancelled remaining '+(changes.length-changeindex)+' changes');
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
