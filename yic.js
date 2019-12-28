const {bind, wire} = hyperHTML;
/**
 * Global variables
 */
var session_token;
var sse_active = false;
var interlvalID;

var sensors = {};
var workflows = {};
var uilayouts = {};

// JSONEditor https://github.com/josdejong/jsoneditor
var json_editor = new JSONEditor(document.getElementById("jsoneditor"), genJSONEditorOption());
var wk_json_editor = new JSONEditor(document.getElementById("workflow_jsoneditor"), {
    modes: ['tree', 'code', 'view'],
    onModeChange: (newMode, oldMode) => {
        if (newMode == 'code') {
            wk_json_editor.editor.setOptions({maxLines: 1000});
        }
    }
});

/**
 * view change the global view on the page
 * @param {*} page 
 */
function view(page) {
    var el = document.getElementById("wrapper_"+page);
    if (!el) {
        console.log( page, "view not found")
        return;
    }
    var views = ["login", "validation", "city"];
    for (i in views) {
        if (views[i] === page) {
            continue;
        }
        document.getElementById("wrapper_"+views[i]).hidden = true;
    }
    el.hidden = false;
}


// switch from signup to login
function login_view(event) {
    document.getElementById("signup_tab").className =  "";
    document.getElementById("signup").hidden = true;

    document.getElementById("login_tab").className = "active";
    document.getElementById("login").hidden = false;
}
// switch from login to singup
function signup_view(event) {
    document.getElementById("login_tab").className = "";
    document.getElementById("login").hidden = true;

    document.getElementById("signup_tab").className ="active";
    document.getElementById("signup").hidden = false;
}

function isLoggedin() {
    return !!localStorage.getItem("app_token");
}

function ready(fn) {
    if (document.attachEvent ? document.readyState === "complete" : document.readyState !== "loading"){
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

/*
 * First think to happen when enter in the page
 */
ready(function () {
    if (!isLoggedin()) {
        view("login");
    }else{
        view("city");
        city();
    }
});

/**
 * Logout
 */
function logout(event) {
    localStorage.removeItem("app_token");
    view("login");
}

/*
 * Signup function
 */
function signup(event) {
    var data = JSON.stringify({
        "email": document.getElementById("signup_email").value,
        "type": "god",
        "name": "web-view",
    });

    console.log(data)

    // spin the button
    this.className = "spining";

    var res = document.getElementById("signup_result");

    var xhr = new XMLHttpRequest();
    var url = "https://yicauth.cleverapps.io/auth/signup";
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.onload = function (event) {
        console.log(xhr.responseText);

        switch (xhr.status) {
            case 200:
                var json = JSON.parse(xhr.responseText);
                app_token = json.app_token;
                localStorage.setItem("app_token", app_token)

                res.style.visibility="hidden";
                this.className="signup_ok";
                city();
                break;

            default:
                res.innerHTML = xhr.statusText;
                res.hidden = false;
                res.className = "signup_error";
                this.className = "";
        }
    }
    xhr.onerror = function (event) {
        console.log(event)
        res.innerHTML = "Network error";
        res.hidden = false;
        res.className = "signup_error";
        this.className = "";
    }
    xhr.send(data);
}

/**
 * login
 */
function login(event) {
    var data = JSON.stringify({
        "email": document.getElementById("login_email").value,
        "type": "god",
        "name": "web-view",
    });

    console.log(data)

    // spin the button
    event.target.className = "spining"

    var res = document.getElementById("login_result");

    var xhr = new XMLHttpRequest();
    var url = "https://yicauth.cleverapps.io/auth/login";
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.onload = function (event) {
        console.log(xhr.responseText);
        
        switch (xhr.status) {
            case 200:
                var json = JSON.parse(xhr.responseText);
                console.log(json);
                app_token = json.app_token;
                localStorage.setItem("app_token", app_token)

                res.style.visibility="hidden";
                this.className= "login_ok";
                city();
                break;

            default:
                res.innerHTML = xhr.statusText;
                res.hidden = false;
                res.className = "login_error";
                this.className = "";
        }
    }
    xhr.onerror = function (event) {
        console.log(event)
        res.innerHTML = "Network error";
        res.hidden = false;
        res.className = "login_error";
        this.className = "";
    }
    xhr.send(data);
}

function city() {
    updateToken();
    updateTokenType();
    updateWorkflows();
    updateWorkflowOperation();
    callSSE();
    // connectWS();
}

function callSSE() {
    if (sse_active) {
        return;
    }

    var sse = new EventSource("https://yicsse.cleverapps.io/sse") //, { authorizationHeader: session_token});

    sse.addEventListener('open', function () {
        sse_active = true;
        console.log("sse open");
    }, false);

    sse.addEventListener('error', function(err) {
        if (err.readyState == EventSource.CLOSED) {
            console.log("sse connection closed");
        } else {
            console.log("sse error:", err);
        }
        sse_active = false;
    }, false);

    sse.addEventListener('ui.layout', function(event) {
        updateLastSSETime();
        if (event.data) {
            var l = JSON.parse(event.data)
            updateUILayout(l)
        }
    }, false);
    sse.addEventListener('ui.layout.delete', function(event) {
        updateLastSSETime();
        if (event.data) {
            delete uilayouts[event.data]
            updateUILayout()
        }
        console.log("ui.layout.delete", event.data)
    }, false);

    sse.addEventListener('sensors', function(event) {
        updateLastSSETime();
        var s = JSON.parse(event.data)
        updateSensors(s)
    }, false);

    sse.addEventListener('message', function(event) {
        console.log("sse", event.data)
    }, false);
}

function connectWS() {
    console.log("Stating to connectWS");

    var loc = window.location;
    var uri = 'ws:';

    if (loc.protocol === 'https:') {
      uri = 'wss:';
    }
    uri += '//' + loc.host;
    uri += loc.pathname + 'ws';

    ws = new WebSocket(uri)

    ws.onopen = function() {
        console.log('Connected')
    }

    ws.onmessage = function(evt) {
        console.log(evt)
    }

    ws.onerror = function(e) {
        console.log(e);
    }

    setInterval(function() {
      ws.send('Hello, Server!');
    }, 3000);

    return;
    

    var socket = io({
        transports: ['websocket'],
        path: '/ws'
      });
    socket.on('connect', function () {
        socket.send('hi');

        socket.on('message', function (msg) {
            console.log(msg)
        });
    });
    socket.on('error', console.log);
}

function updateSensors(sensor) {
    const id = sensor.id
    const isNew = !(id in sensors)

    sensor.last_update = new Date()
    sensors[id] = sensor

    hyperHTML.bind(document.getElementById('sensors-list'))`
    <table class="monospace">
        <tr>
            <th>ID</th>
            <th>Last update</th>
            <th>Message json</th>
        </tr>
        ${Object.values(sensors).map(s => wire(s)`
        <tr>
            <td>${s.id}</td>
            <td>${moment(s.last_update).fromNow()}</td>
            <td>${JSON.stringify(s, (k,v)=>{if (k!=='id' && k!=='last_update') {return v}})}</td>
        </tr>
        `)}
    </table>`;
}

function updateUILayout(layout) {
    if (layout && layout.id) {
        uilayouts[layout.id] = layout
    }

    function editView(id) {
        json_editor.set(uilayouts[id])
        document.getElementById("layout_editor").hidden = false;
    }

    function deleteLayout(id) {
        fetch('https://yicui.cleverapps.io/ui/layout/'+id, {
            method: 'DELETE',
            credentials: 'same-origin',
        }).then(updateUILayout);
    }

    // console.log("update", uilayouts)

    hyperHTML.bind(document.getElementById('layouts-list'))`
    <table class="monospace">
        <tr>
            <th>ID</th>
            <th>City Name</th>
            <th></th>
            <th></th>
        </tr>
    ${Object.values(uilayouts).map(layout => wire(layout)`
        <tr key="${layout.id}">
            <td>${layout.id}</td>
            <td>${layout.name}</td>
            <td><button onclick="${e => editView(layout.id)}">edit/view</button></td>
            <td><button onclick="${e => deleteLayout(layout.id)}">delete</button></td>
        </tr>
    `)}
    </table>`;
}

function handlesendlayout(event) {
    var json = json_editor.get()
    send_layout(json)
}

function updateLastSSETime() {
    var d = new Date();
    document.getElementById('last_sse_time').innerHTML = "Update at "+d.toLocaleTimeString();
}

function genJSONEditorOption() {
    const schema = {
        "title": "UI Layout Schema",
        "type": "object",
        "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            "grid": { "$ref": "#/definitions/grid" },
            "roads": { "type": "array", "items": { "type": "string" }},
            "buildings" : { "type": "array", "items": { "$ref": "#/definitions/buildings" }},
            "moving_objects": { "type": "array"}
        },
        "required": ["id","name", "grid","buildings","roads"],

        "definitions": {
            "grid": {
                "type": "object", 
                "properties": {
                    "width": { "type": "integer", "minimum": 0 },
                    "height": { "type": "integer", "minimum": 0 },
                },
                "required": ["width", "height"]
            },
            "buildings": {
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "name": { "type": "string" },
                    "type": { "type": "string" },
                    "roles": { "type": "array", "items": { "type": "string" }},
                    "orientation": { "enum": ["N","S","E","W"] },
                    "location": {
                        "type": "object",
                        "properties": {
                            "x": { "type": "integer" },
                            "y": { "type": "integer" },
                        },
                        "required": ["x", "y"]
                    }
                },
                required: ["id", "type"]
            }
        }
    }

    return {
        schema: schema,
        modes: ['tree', 'code', 'view'],
        onModeChange: (newMode, oldMode) => {
            if (newMode == 'code') {
                json_editor.editor.setOptions({maxLines: 1000});
            }
        }
    }
}

function newlayout() {
    var default_layout = {
        "id": uuidv4(),
        "name": "Mon Infra  demo",
        "grid": {
            "width": 3,
            "height": 4
        },
        "roads": [
            "000",
            "111",
            "010",
            "010"
        ],
        "buildings": [
            {
            "id": "cd0a6b8a-a32f-4cec-bd4d-38b24ac793e0",
            "name": "Server DB",
            "type": "windmill",
            "roles": [
                "server"
            ],
            "location": {
                "x": 1,
                "y": 0
            }
            }
        ]
    }

    json_editor.set(default_layout)

    document.getElementById("layout_editor").hidden = false;
}

function send_layout(layout) {
    const data = JSON.stringify(layout)
    console.log(layout)

    var xhr = new XMLHttpRequest();
    var url = "https://yicui.cleverapps.io/ui/layout";
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-type", "application/json");
    // xhr.setRequestHeader("Authorization", "Bearer "+session_token)

    xhr.onload = function (event) {
        console.log(xhr.responseText);
        
        switch (xhr.status) {
            case 200:
                console.log(xhr.statusText)
                break;

            default:
                console.log(xhr.statusText)
        }
    }
    xhr.onerror = function (event) {
        console.log(event)
    }
    xhr.send(data);
}

// from https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    )
}



/* **************************************************************************
 *  
 *    Token management
 */

function updateToken() {
    fetch("https://yicauth.cleverapps.io/account/token", {
        credentials: 'same-origin',
    })
    .then(response => response.json())
    .then(res => {
        hyperHTML.bind(document.getElementById("token_table"))`${token_table({tokens:res})}`
    }).catch(e => console.log(e));
}

function updateTokenType() {
    fetch('https://yicauth.cleverapps.io/auth/roles')
    .then(res => res.json())
    .then(roles => {
        let select = document.getElementById('token_type');
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
        Object.keys(roles).map(k => {
            let option = document.createElement('option');
            option.innerText = k + ' ' + JSON.stringify(roles[k]);
            option.setAttribute('value', k);
            select.appendChild(option);
        })
    })
    .catch(e => console.log(e));
}

function createToken(event) {
    if (event) { event.preventDefault(); }

    fetch('https://yicauth.cleverapps.io/account/token', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        credentials: 'same-origin',
        body: JSON.stringify({
            'name': document.getElementById('token_name').value,
            'type': document.getElementById('token_type').value,
        }),
    })
    .then(res => res.json())
    .then(res => {
        updateToken();
    })
    .catch(e => console.log(e));
}


function token_table(props) {
    function handleRevoke(e, token) {
        e.preventDefault();
        console.log(e, token)
        fetch('https://yicauth.cleverapps.io/account/token/'+token, {
            method: 'DELETE',
            credentials: 'same-origin',
        }).then(updateToken);
    }
    function handleValidation(e, link) {
        e.preventDefault();
        console.log(e, link)
        fetch(link).then(updateToken)
    }
    return hyperHTML.wire()`
    <table id="token_table" class="monospace">
        <tr>
            <th>Token</th>
            <th>Name</th>
            <th>Type</th>
            <th>Roles</th>
            <th>Created</th>
            <th>Expire</th>
            <th></th>
        </tr>
        ${props && props.tokens && props.tokens.map(token => wire(token)`
        <tr>
            <td>${token.app_token}</td>
            <td>${token.name}</td>
            <td>${token.type}</td>
            <td>${JSON.stringify(token.roles)}</td>
            <td>${moment(token.created_at).fromNow()}</td>
            <td>${moment(token.expired_at).fromNow()}</td>
            <td>
                <button onClick=${e => handleRevoke(e, token.app_token)}>revoke</button>
                ${token.validation_link && wire(token)`
                <button onClick=${e => handleValidation(e, token.validation_link)}>validate</button>
                `}
            </td>
        </tr>
        `)}
    </table>`;
}


/* **************************************************************************
 *  
 *    Workflow
 */

function updateWorkflowOperation() {
    fetch("/workflow/operation").then(res => res.json()).then(res => {
        hyperHTML.bind(document.getElementById("workflow_operations"))`${workflowOperation({operations: res})}`;
    });
}

function workflowOperation(props) {
    if (!props || ! props.operations) {
        return hyperHTML.wire()`<p>None</p>`;
    }
    return hyperHTML.wire()`
    <div>
        <h3>Operations</h3>
        <div class="operation_list">
            ${Object.keys(props.operations).map(k => {return {name: k, op: props.operations[k]}}).map(k => wire(k)`
            <div class="operation">
                <h3>${k.op.name}</h3>
                <p>
                    output: ${k.op.output_type}<br />
                    inputs: ${k.op.inputs_type}<br />
                    len: ${k.op.max_len_input}
                </p>
            </div>
            `)}
        </div>
    </div>
    `;
}

function updateWorkflows() {
    fetch("/workflow").then(res => res.json()).then(res => listWorkflows({workflows: res}))
}

function listWorkflows(props) {
    if (props && props.workflows) {
        workflows = props.workflows
    }
    function editView(id) {
        wk_json_editor.set(workflows.find(e => e.id == id))
        document.getElementById("workflow_editor").hidden = false;
    }
    function deleteWorflow(id) {
        fetch('/workflow/'+id, {
            method: 'DELETE',
            credentials: 'same-origin',
        }).then(updateWorkflows);
    }
    hyperHTML.bind(document.getElementById("workflow_list"))`
    <table class="monospace">
        <tr>
            <th>ID</th>
            <th>Name</th>
            <th>view</th>
            <th></th>
        </tr>
        ${props && props.workflows.map(wk => wire(wk)`
        <tr>
            <td>${wk.id}</td>
            <td>${wk.name}</td>
            <td><button onClick=${e => editView(wk.id)}>edit</button></td>
            <td><button onClick=${e => deleteWorflow(wk.id)}>delete</button></td>
        </tr>
        `)}
    </tables>
    `;
}

function sendWorkflow(event) {
    if (event) { event.preventDefault(); }

    fetch('/workflow', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        credentials: 'same-origin',
        body: JSON.stringify(wk_json_editor.get()),
    })
    .then(updateWorkflows)
    .catch(e => console.log(e));
}

function newWorkflow() {
    var wk = {
        "id": "0b034fe4-003c-4cda-9fcf-5040ac4d3ac1",
        "created_at": "2019-01-31T15:10:11.65084Z",
        "accound_id": "74b29b98-f9b3-43a5-86fb-0999c7078b9e",
        "name": "Moulin flow",
        "worker": "workflow-engine0",
        "version": "",
        "graph": {
          "cpu": {
            "id": "1377959e-97ce-46c1-9715-22c34bb9afbe",
            "name": "loadaverage",
            "type": "float",
            "operator": "input"
          },
          "ncpu": {
            "id": "1377959e-97ce-46c1-9715-22c34bb9afbe",
            "name": "numcpu",
            "type": "float",
            "operator": "input",
            "description": "Number of CPUs of the server"
          },
          "const0": {
            "type": "float",
            "operator": "const",
            "ComputedValue": 0.8
          },
          "status": {
            "id": "1377959e-97ce-46c1-9715-22c34bb9afbe",
            "name": "status",
            "type": "enum",
            "operator": "input"
          },
          "rel_cpu": {
            "inputs": [
              "cpu",
              "ncpu"
            ],
            "operator": "div"
          },
          "isfailure": {
            "inputs": [
              "status",
              "const_failure"
            ],
            "operator": "contains_exactly"
          },
          "isoffline": {
            "inputs": [
              "status",
              "const_offline"
            ],
            "operator": "contains_exactly"
          },
          "const_stop": {
            "type": "string",
            "operator": "const",
            "ComputedValue": "stop"
          },
          "const_broken": {
            "type": "string",
            "operator": "const",
            "ComputedValue": "broken"
          },
          "const_failure": {
            "type": "string",
            "operator": "const",
            "ComputedValue": "failure"
          },
          "const_offline": {
            "type": "string",
            "operator": "const",
            "ComputedValue": "offline"
          },
          "propeler_stop": {
            "inputs": [
              "isoffline",
              "const_stop",
              "propeler_broken"
            ],
            "operator": "match_str"
          },
          "windmill_fire": {
            "id": "cd0a6b8a-a32f-4cec-bd4d-38b24ac793e0",
            "name": "on_fire",
            "type": "enum",
            "inputs": [
              "isfailure"
            ],
            "operator": "output"
          },
          "windmill_grey": {
            "id": "cd0a6b8a-a32f-4cec-bd4d-38b24ac793e0",
            "name": "grey",
            "type": "bool",
            "inputs": [
              "isoffline"
            ],
            "operator": "output"
          },
          "propeler_broken": {
            "inputs": [
              "isfailure",
              "const_broken",
              "cpu_propeler_speed"
            ],
            "operator": "match_str"
          },
          "cpu_propeler_speed": {
            "inputs": [
              "rel_cpu"
            ],
            "values": [
              "stop",
              "slow",
              "medium",
              "fast"
            ],
            "operator": "select",
            "condition": [
              "0:.001",
              ".001:.3",
              ".3:.6",
              ".6:1"
            ]
          },
          "windmill_propeler_speed": {
            "id": "cd0a6b8a-a32f-4cec-bd4d-38b24ac793e0",
            "name": "propeler",
            "type": "enum",
            "inputs": [
              "propeler_stop"
            ],
            "values": [
              "stop",
              "slow",
              "medium",
              "fast",
              "broken"
            ],
            "operator": "output"
          }
        }
      }

    wk_json_editor.set(wk)

    document.getElementById("workflow_editor").hidden = false;
}



/* **************************************************************************
 *  
 *    Simulate sensors
 */
const simulator = {
    html: hyperHTML.bind(document.getElementById("sensors_simulator")),
    data: {
        msg: {id: "1377959e-97ce-46c1-9715-22c34bb9afbe", status: "running", loadaverage: 0, numcpu:4},
        sendOnChange: true,
    },
    send() {
        fetch("https://yicsensor.cleverapps.io/sensors", {
            method: 'POST',
            headers: {"Content-Type": "application/json"},
            credentials: 'same-origin',
            body: JSON.stringify(this.data.msg)
        });
    },
    startstop(event) {
        event.preventDefault();
        this.send();
    },
    updateStatus(event) {
        this.data.msg.status = event.target.value;
        this.data.sendOnChange && this.send();
        this.render();
    },
    handleCPURange(event) {
        this.data.msg.loadaverage = parseFloat(event.target.value);
        this.data.sendOnChange && this.send();
        this.render();
    },
    handleID(event) {
        this.data.msg.id = event.target.value;
        this.render();
    },
    render() {
        this.html`<div>
            <input placeholder="uuid of the sensors" size="36" oninput=${e=>this.handleID(e)} value=${this.data.msg.id} />

            <input type="range" name="loadaverage" oninput=${e=>this.handleCPURange(e)} value=${this.data.msg.loadaverage} min="0" max=${this.data.msg.numcpu} step="0.05" />
            <div style="display: inline-block;">
                <input name="status" type="radio" oninput=${e=>this.updateStatus(e)} value="running" checked /><label>running</label><br>
                <input name="status" type="radio" oninput=${e=>this.updateStatus(e)} value="offline" /><label>offline</label><br />
                <input name="status" type="radio" oninput=${e=>this.updateStatus(e)} value="failure" /><label>failure</label>
            </div>

            <input type="checkbox" oninput=${e=>this.data.sendOnChange = e.target.value} checked=${this.data.sendOnChange} /><label>send on change</label>
            <button onclick=${e=>this.startstop(e)}>Send</button>
            <br/>
            <p class="monospace">${JSON.stringify(this.data.msg)}</p>
        </div>`;
    }
}
simulator.render();
