var express = require('express');
var router = express.Router();
const twilio = require('twilio');

let _ = require('lodash');

let settings = require('../settings');

const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

const RtmClient = require('@slack/client').RtmClient,
      WebClient = require('@slack/client').WebClient;

const webSlack = new WebClient(settings.slack.APIkey);

/* GET home page. */
/* Used for testing only */
router.get('/', function(req, res, next) {
    let recordingUrl = 'https://google.com';

    let data = {
    "text": "Would you like to play a game?",
    "attachments": [
        {
            "text": "Choose a game to play",
            "fallback": "You are unable to choose a game",
            "callback_id": "wopr_game",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "chess",
                    "text": "Chess",
                    "type": "button",
                    "value": "chess"
                },
                {
                    "name": "maze",
                    "text": "Falken's Maze",
                    "type": "button",
                    "value": "maze"
                },
                {
                    "name": "war",
                    "text": "Thermonuclear War",
                    "style": "danger",
                    "type": "button",
                    "value": "war",
                    "confirm": {
                        "title": "Are you sure?",
                        "text": "Wouldn't you prefer a good game of chess?",
                        "ok_text": "Yes",
                        "dismiss_text": "No"
                    }
                }
            ]
        }
    ]
}

    webSlack.chat.postMessage('#bot-testing', '', data, () => {

        res.render('index', { title: 'Express' });
    });
});

/* When Twilio phone number is called */
/* Step 1 */
router.post('/call', function (req, res, next) {
    const caller = req.body.Caller;
    const callSid = req.body.CallSid;

    let twiml = new twilio.TwimlResponse();

    twiml.say('Hello! State your name, then press any key.', {voice: 'alice'});

    twiml.record({
        action: `/call/recording/${callSid}`,
        //transcribe: true,
        //transcribeCallback: `/call/recording/${callSid}`,
        maxLength: 60
    });

    res.type('text/xml');
    res.send(twiml.toString());
});

/* When Twilio sends us the recording */
/* Step 2 */
router.post('/call/recording/:callSid', (req, res, next) => {
    const callSid = req.params.callSid;
    const twiml = new twilio.TwimlResponse();
    const recordingUrl = req.body.RecordingUrl;

    let data = {
        attachments: [{
            fallback: 'Somebody is at the door',
            title: 'Somebody is at the door',
            title_link: recordingUrl,
            text: 'Click link to hear the recording',
            callback_id: `door_open:${callSid}`,
            actions: [
                {
                    name: 'open_door',
                    text: 'Let them in',
                    type: 'button',
                    value: 'open_door'
                },
                {
                    name: 'deny_access',
                    text: 'No.',
                    type: 'button',
                    value: 'deny_access'
                }
            ]
        }]
    };

    /* Post on Slack, pause Twilio phone call */
    webSlack.chat.postMessage('#bot-testing', '', data, () => {
        twiml.say('Thank you. Please hold.', {voice: 'alice'});
        twiml.pause({length: 240});
        twiml.say('Sorry, nobody pressed the button. Try calling a real human.', {voice: 'alice'});

        res.type('text/xml');
        res.send(twiml.toString());
    });
});

/* When button is clicked on Slack */
/* Step 3 */
router.post('/slack/response', (req, res, next) => {
    const payload = JSON.parse(req.body.payload);

    const callSid = payload.callback_id.split(':')[1];
    const action = payload.actions[0];
    const client = twilio(settings.twilio.accountSid, settings.twilio.authToken);

    let continueAt = '',
        lettingIn = false;

    if (action.value === 'open_door') {
        continueAt = 'call/open_the_door'
        lettingIn = true;
    }else{
        continueAt = 'call/dont_open_door';
        lettingIn = false;
    }

    client.calls(callSid).update({
        url: `https://swizec.ngrok.io/${continueAt}`,
        method: 'POST'
    }, (err, call) => {
        res.send({
            text: lettingIn ? "Letting them in" : "Telling them to go away"
        });
    });
});

router.get('/handle_slack_callback', (req, res) => {
    console.log(req.session.grant.response);

    res.end(JSON.stringify(req.session.grant.response, null, 2));
});

router.post('/call/open_the_door', (req, res, next) => {
    const twiml = new twilio.TwimlResponse();

    twiml.say('Greetings! Come on up.', {voice: 'alice'});
    twiml.play({digits: 9});

    res.type('text/xml');
    res.send(twiml.toString());
});

router.post('/call/dont_open_door', (req, res, next) => {
    const twiml = new twilio.TwimlResponse();

    twiml.say('Sorry, nobody pressed the button. Try calling a real human.', {voice: 'alice'});

    res.type('text/xml');
    res.send(twiml.toString());
});

module.exports = router;
