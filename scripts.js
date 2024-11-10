document.addEventListener('DOMContentLoaded', () => {
    console.log('Study Flow script loaded successfully!');
    let timerInterval;
    let timeElapsed = 0; 
    let breakTime = false;
    
    const freeTab = document.getElementById('free-tab');
    const calendarTab = document.getElementById('calendar-tab');
    const freeView = document.getElementById('free-view');
    const calendarView = document.getElementById('calendar-view');
    const addButton = document.getElementById('add');
    var addStatus = false;
    addButton.addEventListener('click', () => {
        if (!addStatus) {
            showColorOptions();
        }
        else {
            removeColorOptions();
        }
        addStatus = !addStatus;
    });
    
    freeTab.addEventListener('click', () => {
        freeTab.classList.add('active');
        calendarTab.classList.remove('active');
        freeView.classList.add('active');
        calendarView.classList.remove('active');
        removeColorOptions();
    });
    
    calendarTab.addEventListener('click', () => {
        calendarTab.classList.add('active');
        freeTab.classList.remove('active');
        calendarView.classList.add('active');
        freeView.classList.remove('active');
        removeColorOptions();
        calendar.updateSize(); 
    });

    chrome.storage.sync.get(['boxes', "currentTask"], (data) => {
        if (data.boxes) {
            data.boxes.forEach(boxData => createMovableBox(boxData));
        }
        if (data.currentTask) {
            const { topic, duedate, assignment, time } = data.currentTask;
            document.querySelectorAll(".box").forEach(box => {
                const boxTopic = box.querySelector("#topic").textContent;
                if (boxTopic === topic) {
                    startTask(box, false);
                }
            })
        }
    });

    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        editable: true,
        events: [],

        eventDrop: function(info) {
            handleEventUpdate(info.event);
        },
        eventResize: function(info) {
            handleEventUpdate(info.event);
        }
    });

    function reloadCalendar() {
        calendar.getEvents().forEach(event => event.remove());
        chrome.storage.sync.get(['boxes'], (data) => {
            console.log(data.boxes);
            if (data.boxes) {
                data.boxes.forEach(box => {
                    console.log("adding", box.topic, "to calendar");
                    calendar.addEvent({
                        title: box.topic,
                        allDay: true,
                        start: box.duedate,
                        color: box.color,
                        interactive: true,
                        assignment: box.assignment,
                        controls_left: box.controls_left,
                        controls_top: box.controls_top,
                        left: box.left,
                        number: box.number,
                        status: box.status,
                        top: box.top,
                    })
                });
            }
        });
    }

    calendar.render();

    function handleEventUpdate(event) {
        const updatedEvent = {
            id: event.id,
            title: event.title,
            start: event.start.toISOString(),
            color: event.backgroundColor,
            time: event.extendedProps.time,
            assignment: event.extendedProps.assignment,
        };
    
        chrome.storage.sync.get(['boxes'], (data) => {
            const updatedBoxes = data.boxes.map(box => {
                if (box.number === event.extendedProps.number) {
                    box.duedate = new Date(updatedEvent.start).getTime();
                    
                    const boxElement = document.querySelector(`.box[number="${box.number}"]`);
                    if (boxElement) {
                        const duedateElement = boxElement.querySelector('#duedate');
                        const luxonDate = luxon.DateTime.fromMillis(box.duedate);
                        duedateElement.textContent = luxonDate.toRelative({ base: luxon.DateTime.now() });

                        if (luxonDate < luxon.DateTime.now()) {
                            duedateElement.classList.add('past-due');
                        } else {
                            duedateElement.classList.remove('past-due');
                        }
                    }
                }
                return box;
            });

            chrome.storage.sync.set({ boxes: updatedBoxes }, () => {
                reloadCalendar();
            });
        });
    }

    function showColorOptions() {
        const colors = ['#add8e6', '#F8DE7E', '#F8C8DC', '#AFE1AF', '#E6E6FA'];
        const addButton = document.getElementById('add');
        
        colors.forEach((color, index) => {
            const colorButton = document.createElement('button');
            colorButton.className = 'color-option';
            colorButton.style.backgroundColor = color;
            
            const angle = (index / colors.length) * (2 * Math.PI);
            const offset = 80; 
            const left = addButton.offsetLeft + offset * Math.cos(angle);
            const top = addButton.offsetTop + offset * Math.sin(angle);
            
            colorButton.style.left = `${left + 22}px`;
            colorButton.style.top = `${top + 25}px`;
            
            colorButton.addEventListener('click', () => {
                createMovableBox(null, color);
                removeColorOptions();
                addStatus = false;
            });
            
            document.body.appendChild(colorButton);
            
            requestAnimationFrame(() => {
                colorButton.style.animation = 'expandFromCenter 0.3s ease-out';
            });
        });
    }

    function removeColorOptions() {
        const colorButtons = document.querySelectorAll('.color-option'); 
        colorButtons.forEach((colorButton) => {
            colorButton.style.animation = 'fadeOutAndShrink 0.3s ease-out forwards';
            colorButton.addEventListener('animationend', () => {
                colorButton.remove();
            });
        });
    }

    function startTimer(taskDuration, box) {
        let taskTimeStart = Date.now();
        let taskTimeElapsed = 0;

        let breakInterval;
        let breakDuration;
        let nextBreakTime;
        let breakInProgress = false;

        if (taskDuration <= 60 * 60 * 1000) { // If task duration <= 1 hour
            breakInterval = taskDuration / 2;
            breakDuration = 5 * 60 * 1000; // 5 minutes
        } else {
            breakInterval = 60 * 60 * 1000; // Every 1 hour
            breakDuration = 10 * 60 * 1000; // 10 minutes
        }

        nextBreakTime = breakInterval;

        const countdownElement = box.querySelector('.break-countdown');
        if (!countdownElement) {
            const countdownDisplay = document.createElement('p');
            countdownDisplay.className = 'break-countdown';
            countdownDisplay.textContent = '';
            box.querySelector('.break-checkbox').parentNode.appendChild(countdownDisplay);
        }

        timerInterval = setInterval(() => {
            taskTimeElapsed = Date.now() - taskTimeStart;

            if (!breakInProgress) {
                const timeUntilNextBreak = nextBreakTime - taskTimeElapsed;
                const countdownDisplay = box.querySelector('.break-countdown');
                const minutes = Math.floor((timeUntilNextBreak / 1000) / 60);
                const seconds = Math.floor((timeUntilNextBreak / 1000) % 60);
                countdownDisplay.textContent = `Time until next break: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            }

            if (taskTimeElapsed >= nextBreakTime && !breakInProgress && box.querySelector('.break-checkbox').checked) {
                breakInProgress = true;
                console.log("Time for a break!");
                showBreakScreen(breakDuration / 1000, box); // Pass duration in seconds

                chrome.storage.sync.get('currentTask', (data) => {
                    const currentTask = data.currentTask || {};
                    currentTask.blockeverything = true;
                    chrome.storage.sync.set({ currentTask });
                });
                setTimeout(() => {
                    console.log("Break ended.");
                    breakInProgress = false;
                    chrome.storage.sync.get('currentTask', (data) => {
                        const currentTask = data.currentTask || {};
                        currentTask.blockeverything = false;
                        chrome.storage.sync.set({ currentTask });
                    });
                    if (taskDuration - taskTimeElapsed >= breakInterval) {
                        nextBreakTime += breakInterval;
                        console.log("Next break scheduled.");
                    } else {
                        nextBreakTime = taskDuration + 1; // No more breaks
                        console.log("No more breaks, task will end soon.");
                        box.querySelector('.break-countdown').textContent = '';
                    }
                }, breakDuration);
            }
            if (taskTimeElapsed >= taskDuration) {
                clearInterval(timerInterval);
                box.querySelector('.break-countdown').textContent = '';
                showCompletionPrompt(box); // Pass box
                console.log("Task completed!");
            }
        }, 1000);
    }

    function showBreakScreen(breakDurationInSeconds, box) {
        const breakScreen = document.createElement('div');
        breakScreen.className = 'break-screen';
        breakScreen.innerHTML = `
            <div class="break-content">
                <h2>Break Time!</h2>
                <p>Take a short break. The task will resume automatically in ${breakDurationInSeconds / 60} minutes.</p>
            </div>
        `;
        document.body.appendChild(breakScreen);

        setTimeout(() => {
            breakScreen.remove();
        }, breakDurationInSeconds * 1000);
    }    

    function startTask(box, save = true) {
        document.querySelectorAll('.box').forEach(b => {
            if (b !== box) {
                const controls = b.nextElementSibling;
                controls.querySelector('.start-btn').style.display = 'block';
                controls.querySelector('.pause-btn').style.display = 'none';
                controls.querySelector('.finish-btn').style.display = 'none';
            }
        });
        
        const controls = box.nextElementSibling;
        controls.querySelector('.start-btn').style.display = 'none';
        controls.querySelector('.pause-btn').style.display = 'block';
        controls.querySelector('.finish-btn').style.display = 'block';

        const taskDuration = parseInt(box.querySelector('#time').textContent) * 60 * 1000;
        console.log("time", taskDuration);
        timeElapsed = 0;
        startTimer(taskDuration, box);

        if (save) {
            const data = {
                topic: box.querySelector('#topic').textContent,
                duedate: box.querySelector('#duedate').textContent,
                assignment: box.querySelector('#assignment').textContent,
                time: box.querySelector('#time').textContent,
                status: 'started'
            };
            chrome.storage.sync.set({ currentTask: data }, () => {
                console.log("setting to", data);
                setTimeout(() => {
                    window.close();
                }, 750);
            });
        }
    }

    function createMovableBox(savedData = null, selectedColor = '#add8e6') {
        var box_amounts = savedData?.number || document.querySelectorAll(".box").length;

        const free = document.getElementById("free-view");
        
        const box = document.createElement('div');
        box.className = 'box';
        box.style.backgroundColor = savedData?.color || selectedColor;
        box.setAttribute("number", box_amounts);
        box.innerHTML = `
            <h2 id="topic" contenteditable="false">Topic</h2>
            <p id="duedate">Due Date</p>
            <p id="assignment" contenteditable="false">Assignment Info</p>
            <p id="time" contenteditable="false">Time to complete (in minutes)</p>
            <label><input type="checkbox" class="break-checkbox"> Take Breaks</label>`;
        free.appendChild(box);
        
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.setAttribute("number", box_amounts);
        controls.innerHTML = `
            <button class="start-btn" style="display: block;"><i class="fa-solid fa-play" style="color: #63E6BE;"></i></button>
            <button class="pause-btn" style="display: none;"><i class="fa-solid fa-pause" style="color: #FFA500;"></i></button>
            <button class="finish-btn" style="display: block;"><i class="fa-solid fa-check" style="color: #28a745;"></i></button>
            <button class="edit-btn"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="trash-btn"><i class="fa-solid fa-trash"></i></button>
        `;
        free.appendChild(controls);
        
        const topic = box.querySelector("#topic");
        const duedate = box.querySelector("#duedate");
        const notes = box.querySelector("#assignment");
        const time = box.querySelector("#time");
        
        box.style.left = "40%";
        box.style.top = "40%";
        topic.textContent = 'Topic';
        duedate.textContent = 'Due Date';
        notes.textContent = 'Assignment';
        time.textContent = 'Time to complete (in minutes)';
        
        updateControlsPosition();
        
        if (savedData) {
            controls.style.left = savedData.controls_left;
            controls.style.top = savedData.controls_top;
            box.style.left = savedData.left;
            box.style.top = savedData.top;
            topic.textContent = savedData.topic || 'Topic';
            notes.textContent = savedData.assignment || 'Assignment';
            time.textContent = savedData.time || 'Time to complete (in minutes)';
            
            if (savedData.duedate) {
                box.setAttribute("date", savedData.duedate);
                const luxonDate = luxon.DateTime.fromMillis(savedData.duedate);
                duedate.textContent = luxonDate.toRelative({ base: luxon.DateTime.now() });
                
                if (luxonDate < luxon.DateTime.now()) {
                    duedate.classList.add('past-due');
                } else {
                    duedate.classList.remove('past-due');
                }
            } else {
                duedate.textContent = "Due Date";
            }
            if (savedData.status === 'active') {
                controls.querySelector('.start-btn').style.display = 'none';
                controls.querySelector('.pause-btn').style.display = 'block';
                controls.querySelector('.finish-btn').style.display = 'block';
            } else if (savedData.status === 'paused') {
                controls.querySelector('.start-btn').style.display = 'block';
                controls.querySelector('.pause-btn').style.display = 'none';
                controls.querySelector('.finish-btn').style.display = 'block';
            }

            if (savedData.takeBreaks) {
                box.querySelector('.break-checkbox').checked = savedData.takeBreaks;
                box.querySelector('.break-checkbox').disabled = true;
            }
        }

        function showCompletionPrompt(box) {
            const completionPrompt = document.createElement('div');
            completionPrompt.className = 'completion-prompt';
            completionPrompt.innerHTML = `
                <div class="completion-content">
                    <h2>Task Completed!</h2>
                    <p>Would you like to finish the task?</p>
                    <button id="complete-task">Yes, Complete</button>
                    <button id="continue-task">No, Continue</button>
                </div>
            `;
            document.body.appendChild(completionPrompt);

            document.getElementById('complete-task').onclick = () => {
                finishTask();
                completionPrompt.remove();
            };
            document.getElementById('continue-task').onclick = () => {
                startTimer(parseInt(box.querySelector('#time').textContent) * 60 * 1000 - timeElapsed, box);
                completionPrompt.remove();
            };
        }

        function saveBoxes() {
            const boxes = Array.from(document.querySelectorAll('.box')).map(box => {
                const number = box.getAttribute("number");
                const controls = document.querySelector(`.controls[number="${number}"]`);
                
                let status;
                if (controls.querySelector('.start-btn').style.display === 'block') {
                    status = 'paused';
                } else {
                    status = 'active';
                }
                
                const duedate = parseInt(box.getAttribute("date"));
                
                
                return {
                    number: number,
                    color: box.style.backgroundColor,
                    controls_left: controls.style.left,
                    controls_top: controls.style.top,
                    left: box.style.left,
                    top: box.style.top,
                    topic: box.querySelector('#topic').textContent,
                    duedate: duedate,
                    assignment: box.querySelector('#assignment').textContent,
                    time: box.querySelector('#time').textContent,
                    takeBreaks: box.querySelector('.break-checkbox').checked,
                    status: status
                };
            });
            chrome.storage.sync.set({ boxes });
        }
        var edit_mode = false;
        
        function updateControlsPosition() {
            const boxRect = box.getBoundingClientRect();
            controls.style.left = boxRect.right + 'px';
            controls.style.top = (boxRect.top - controls.offsetHeight) + 'px';
        }
        
        function toggleControls() {
            if (controls.style.display === 'none' || controls.style.display === '') {
                controls.style.display = 'flex';
                controls.classList.remove('fade-out');
                updateControlsPosition();
            } else {
                controls.classList.add('fade-out');
                setTimeout(() => {
                    controls.style.display = 'none';
                }, 500); 
            }
        }
        
        function enterEditMode() {
            edit_mode = true;
            topic.contentEditable = true;
            notes.contentEditable = true;
            time.contentEditable = true;
            box.classList.add('editing');
            box.querySelector('.break-checkbox').disabled = false;
            const text = duedate.textContent;
            const currentDate = parseInt(box.getAttribute("date"));
            console.log(text, currentDate);

            if (text !== 'Due Date') {
                const luxonDate = luxon.DateTime.fromMillis(currentDate);
                duedate.innerHTML = `<input type="date" value="${luxonDate.toFormat('yyyy-MM-dd')}">`;
            
                if (luxonDate < luxon.DateTime.now()) {
                    duedate.classList.add('past-due');
                } else {
                    duedate.classList.remove('past-due');
                }
            } else {
                duedate.innerHTML = `<input type="date">`;
            }
            
            setTimeout(() => {
                document.addEventListener('click', exitEditMode);
            }, 0);
        }
        
        function exitEditMode(event) {
            if (!box.contains(event.target) && !controls.contains(event.target)) {
                console.log("exiting edit mode!");
                // Validate time field
                const timeText = time.textContent.trim();
                const timeValue = parseInt(timeText);
                if (isNaN(timeValue) || timeValue <= 0) {
                    alert('Please enter a valid time in minutes');
                    enterEditMode();
                    return;
                }

                edit_mode = false;
                topic.contentEditable = false;
                notes.contentEditable = false;
                time.contentEditable = false;
                box.querySelector('.break-checkbox').disabled = true;
                const dateInput = duedate.querySelector('input');
                if (dateInput) {
                    const selectedDate = luxon.DateTime.fromISO(dateInput.value);
                    box.setAttribute("date", selectedDate.ts);
                    duedate.textContent = selectedDate.toRelative({ base: luxon.DateTime.now() });

                    if (selectedDate < luxon.DateTime.now()) {
                        duedate.classList.add('past-due');
                    } else {
                        duedate.classList.remove('past-due');
                    }
                }
                
                box.classList.remove('editing');
                
                saveBoxes();
                reloadCalendar();
                
                document.removeEventListener('click', exitEditMode);
            }
        }
        
        function pauseTask() {
            const controls = box.nextElementSibling;
            controls.querySelector('.start-btn').style.display = 'block';
            controls.querySelector('.pause-btn').style.display = 'none';
            controls.querySelector('.finish-btn').style.display = 'block';
            
            clearInterval(timerInterval);
            chrome.storage.sync.set({ currentTask: null });
            saveBoxes();
        }
        
        function finishTask() {
            const controls = box.nextElementSibling;
            if (confirm('Have you completed the task?')) {
                try {
                    const boxRect = box.getBoundingClientRect();
                    const boxCenterX = boxRect.left + boxRect.width / 2;
                    const boxCenterY = boxRect.top + boxRect.height / 2;
                    
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: {
                            x: boxCenterX / window.innerWidth,
                            y: boxCenterY / window.innerHeight
                        }
                    });
                } catch (e) {
                    console.error('Confetti function is not defined:', e);
                }
                
                
                box.classList.add('fade-out');
                controls.classList.add('fade-out');
                setTimeout(() => {
                    box.remove();
                    controls.remove();
                    chrome.storage.sync.set({ currentTask: null });
                    reloadCalendar();
                    saveBoxes();
                }, 500); 
            }
        }
        
        controls.querySelector('.start-btn').onclick = function() {
            startTask(box);
        };
        
        controls.querySelector('.pause-btn').onclick = function() {
            pauseTask();
        };
        
        controls.querySelector('.finish-btn').onclick = function() {
            finishTask();
        };
        
        controls.querySelector(".edit-btn").onclick = function(event) {
            event.stopPropagation();
            if (!edit_mode) {
                enterEditMode();
            } else {
                exitEditMode({ target: document.body });
            }
        };
        
        controls.querySelector('.trash-btn').onclick = function() {
            box.classList.add('fade-out');
            controls.classList.add('fade-out');
            setTimeout(() => {
                box.remove();
                controls.remove(); 
                saveBoxes();
                reloadCalendar();
            }, 500); 
        };
        
        let isDragging = false;
        
        function mousedown(event) {
            isDragging = false;
            
            let shiftX = event.clientX - box.getBoundingClientRect().left;
            let shiftY = event.clientY - box.getBoundingClientRect().top;
            
            let minTop = 0;
            
            function moveAt(pageX, pageY) {
                isDragging = true;
                let newTop = pageY - shiftY;
                box.style.top = Math.max(minTop, newTop) + 'px';
                box.style.left = pageX - shiftX + 'px';
                updateControlsPosition();
            }
            
            function onMouseMove(event) {
                moveAt(event.pageX, event.pageY);
            }
            
            document.addEventListener('mousemove', onMouseMove);
            
            box.onmouseup = function() {
                document.removeEventListener('mousemove', onMouseMove);
                box.onmouseup = null;
                saveBoxes();
            };
        }
        
        box.onmousedown = mousedown;
        
        box.onclick = function(event) {
            if (!isDragging && !edit_mode) {
                toggleControls();
            }
        };
        
        box.ondragstart = function() {
            return false;
        };
        
        saveBoxes();
        reloadCalendar();
    }
});