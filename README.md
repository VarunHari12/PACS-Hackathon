# 📦 Boxly Documentation


## 🏫 Overview 

Boxly is a productivity and organization web extension that allows users to track their tasks and stay focused using active AI blocking. With its wide array of features, users can organize and document tasks in a calendar or bulletin board format. With Boxly, we hope to utilize AI to have a measurable impact on productivity and foster a new working routine for our users.

## 💻 Technical stack

**Languages used** 
   - Python: backend
   - HTML/JS/CSS: Frontend

**Other**  
  
Uses the LLama3 7B parameter model  
Llama.cpp Python bindings for both finetuning the initial Llama3 model using a custom made finetuning dataaset, as well as for running the model on every browser request  
Chrome sync storage API for task storage

## 🤖 AI Capabilities

**AI-Powered Blocking System**
- Boxly leverages the Llama3 7B parameter model to provide intelligent website blocking
- The AI analyzes the current task and determines which websites are potentially distracting or unrelated
- Utilizes a custom-trained machine learning model to enhance accuracy of website blocking

**Model Training**
- Base Model: Llama3 7B parameter model
- Training Approach: 
  * Custom-created fine-tuning dataset
  * Applied LORA (Low-Rank Adaptation) technique to baseline model
  * Improves model's understanding of task-related context

**Technical Implementation**
- Uses Llama.cpp Python bindings for:
  * Fine-tuning the initial Llama3 model
  * Running the model on each browser request
- Processes requests by:
    1. Reading the current task
    2. Analyzing the visited website
    3. Deciding whether to permit or block access

**Blocking Mechanism**
- When a task is started, the AI evaluates:
  * The specific task details such as YouTube video name or Wikipedia article name
  * Websites being visited
  * Potential relevance to the current work
- Provides intelligent blocking to minimize distractions
- Offers contextual reminders to keep users focused on their primary task

**Continuous Improvement**
- The blocking algorithm has been refined through extensive testing
- Aims to provide increasingly accurate task-related website filtering
- Future versions will continue to enhance AI precision and usefulness


## 🏗️ Implementation
  
Finetune the initial LLama3 7B parameter model using the custom finetuning dataset, and apply the output LORA to the baseline model.  
Expose an API with CORS support to allow requests to come in from the web extension.  
Create the Chrome extension's index.html and scripts.js which will serve as the UI, storing all tasks in chrome's storage sync.  
When a user starts a task, push it to the currentTask key, which the content.js file will read on every website visit.  
When a user visits a website, read the currentTask key. If it's defined, send a request to the backend with the website they are visiting as well as their task.  
Use the response from the backend to either do nothing (permit website) or block it by replacing the HTML to remind them of their task.


## 🚀 How to Use

> **Note:** Boxly isn’t yet available on the Chrome Extension Store, but you can still add it to your browser with these simple steps:

1. **Download or Clone Boxly**
   - Access the Boxly project from the [PACS-Hackathon repository](#) and download or clone it.
   - Unzip the downloaded folder to a convenient location on your computer.

2. **Open Extensions in Chrome**
   - Launch your Chrome browser.
   - Click the **Extensions** button in the top-right corner of the screen.

3. **Enable Developer Mode**
   - Select **Manage Extensions** from the Extensions dropdown.
   - Toggle **Developer Mode** on in the top-right corner of the Extensions page.

4. **Load Boxly**
   - Click **Load Unpacked** (top left).
   - Navigate to and select the **Boxly** project folder.

5. **Enable the Extension**
   - After loading, enable Boxly by toggling the switch at the bottom-right of the Boxly extension box.

6. **Reload After Code Changes**
   - If you make any code updates, just click **Reload** in the Boxly extension box to apply changes.

7. **Access Boxly’s Home Page**
   - Click on your extensions list and select **Boxly** to open its homepage.

  
## 🔑 Key Features

**Task Organization and Tracking**
   - You can create a "sticky note" by clicking the plus button and selecting a color
   - You can pause, start, edit, finish, or delete a task with the respective buttons
   - After clicking the edit button, you give the task a name, topic, due date, and estimated time to complete
   - When you click the start button, the break timer and blocking system will automatically start
     
**Calendar**
   - Along with tracking tasks in the normal bulletin board view, you can also switch to the calendar view and see the du dates of all your tasks for the month
   - In this view, you can also drag tasks to different days to change the due date of the task
     
**Blocking and Breaks**
   - When you start a task, an AI blocking algorithm will decide which searches and webpages are related to your assignment and block them accordingly
   - If you select "take breaks", Boxly will automatically give you forced breaks that block anything from being done on your browser


## 🗻Challenges

Currently, there are still some issues with Boxly. We have started the implementations for an "artboards" feature (top right of the home page). We did not have enough time to complete this feature in this version of Boxly but we will do it for future versions. While working on the project, we did have some problems with scaling the website for different screen sizes. Although it isn't perfect, we tried our best and the end result is aesthetically solid. We also had some trouble with getting the blocking algorithm to be accurate. After a lot of testing and training, we have got the algorithm to be pretty accurate which is something we are proud of.

---


Now you’re ready to start using Boxly for enhanced productivity!
