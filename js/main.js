// Note: aws-iot-sdk-browser-bundle is a slimmed down version of AWS sdk namespaced as AWS and AWSIoTData
// It is used for unauthenticated connections

// Note: aws-cognito-sdk is a slimmed down version of the AWS sdk namespaced as AWSCognito
// It is used for authenticated connections

// Note: amazon-cognito-identity
// It is used for AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool

const AWS = require('aws-sdk');
const IOT = require('aws-iot-device-sdk');

AWS.config.region = 'REGION HERE';

const USER_POOL_ID = 'USER POOL ID HERE';
const APP_CLIENT_ID = 'APP CLIENT ID HERE';
const FEDERATED_POOL_ID = 'FEDERATED POOL ID HERE';
const IOT_HOST = 'IOT HOST HERE';
const USER = 'USER HERE';
const PASSWORD = 'PASSWORD HERE';

var authenticated = false;

//-------------------------
// Logging
//-------------------------

function dump(message) {
    console.log(message);
    var element = document.getElementById('CONSOLE');
    element.innerHTML = element.innerHTML + message + '<br/>';
    element.scrollTop = element.scrollHeight;
}

//-------------------------
// AWS Cognito
//-------------------------

function connectUnauthenticated() {

    dump('unathenticated connection ...');

    var cognitoIdentity = new AWS.CognitoIdentity();

    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: FEDERATED_POOL_ID
    });

    // Get a unique identityId for unauthenticated from cognito
    AWS.config.credentials.get((err, data) => {
        if (!err) {
            var params = {
                IdentityId: AWS.config.credentials.identityId
            };
            // Get unauthenticated credentials and session token
            cognitoIdentity.getCredentialsForIdentity(params, (err, data) => {
                if (!err) {
                    mqtt.updateWebSocketCredentials(data.Credentials.AccessKeyId, data.Credentials.SecretKey, data.Credentials.SessionToken);
                } else {
                    dump('error retrieving credentials: ' + err);
                }
            });
        } else {
            dump('error retrieving identity:' + err);
        }
    });
}

function connectAuthenticated() {

    dump('authenticated connection ...');

    // Get Cognito User Pool
    const poolData = { UserPoolId: USER_POOL_ID, ClientId: APP_CLIENT_ID };
    var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(poolData);

    // Get Cognito User
    const userData = { Username: USER, Pool: userPool };
    var cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);

    const authenticationData = { Username: USER, Password: PASSWORD };
    var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);

    // Authenticate User
    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (session) {
            // Note: Use the idToken for Logins Map when Federating User Pools with Cognito Identity
            const url = 'cognito-idp.' + AWS.config.region + '.amazonaws.com/' + USER_POOL_ID;
            const logins = {};
            logins[url] = session.getIdToken().getJwtToken();

            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: FEDERATED_POOL_ID,
                Logins: logins
            });

            // Get a unique identityId, credentials, and session token for authenticated from cognito
            AWS.config.credentials.get((err) => {
                if (!err) {
                    authenticated = true;
                    document.getElementById('STATUS').innerHTML = 'Identity: ' + AWS.config.credentials.identityId;
                    mqtt.updateWebSocketCredentials(AWS.config.credentials.accessKeyId, AWS.config.credentials.secretAccessKey, AWS.config.credentials.sessionToken);
                } else {
                    dump('error: ' + err);
                }
            });
        },
        onFailure: function (err) {
            alert(err);
        }
    });
}

//-------------------------
// MQTT
//-------------------------

var mqtt = IOT.device({
    region: AWS.config.region,
    host: IOT_HOST,
    clientId: 'TV',
    protocol: 'wss',
    maximumReconnectTimeMs: 5000,
    debug: false,
    accessKeyId: '',
    secretKey: '',
    sessionToken: ''
});

mqtt.on('close', () => {
    dump('mqtt close');
});

mqtt.on('connect', () => {
    dump('mqtt connect');
    mqtt.subscribe('meetup/tv');
});

mqtt.on('error', (error) => {
    dump('mqtt error: ' + error);
});

mqtt.on('message', (topic, message, packet) => {
    dump('mqtt message');
    dump('&nbsp;&nbsp;&nbsp;topic: ' + topic);
    dump('&nbsp;&nbsp;&nbsp;payload: ' + message);

    const parts = topic.split('/');
    const results = JSON.parse(message);
    if (results.command) {
        dump('command: ' + results.command);
        switch (results.command) {
            case 'hide':
                hideWindow();
                break;
            case 'show':
                showWindow();
                break;
            case 'volume':
                setVolume(results.level);
                break;
            default:
                dump('Key code : ' + e.keyCode);
                break;
        }
    }
});

mqtt.on('offline', () => {
    dump('mqtt offline');
});

mqtt.on('reconnect', () => {
    dump('mqtt reconnect');
    if (!authenticated) {
        connectAuthenticated();
    }
});

//-------------------------
// TV Functions
//-------------------------

function getAvailableWindows() {
    try {
        tizen.tvwindow.getAvailableWindows(getAvailableWindowsCB);
    } catch (error) {
        dump('Error name = ' + error.name + ', Error message = ' + error.message);
    }
}

function getAvailableWindowsCB(availableWindows) {
    for (var i = 0; i < availableWindows.length; i++) {
        dump('Window [' + i + '] = ' + availableWindows[i]);
    }
}

function getResolution() {
    var res = tizen.tvwindow.getVideoResolution();
    dump('Video resolution: ' + res.width + 'x' + res.height + ' pixels');
    dump('Video aspect ratio: ' + res.aspectRatio);
}

function hideWindow() {
    try {
        tizen.tvwindow.hide(hideWindowCB, null, 'MAIN');
    } catch (error) {
        dump('error: ' + error.name);
    }
}

function hideWindowCB(windowRect, type) {
    /* Expected result: ['0', '0', '50%', '50%'] */
    dump('Rectangle: [' + windowRect[0] + ', ' + windowRect[1] + ', ' + windowRect[2] + ', ' + windowRect[3] + ']');
}

function onVolumeChanged(volume) {
    dump('Volume: ' + volume);
    tizen.tvaudiocontrol.playSound('SELECT');
}

function setVolume(level) {
    tizen.tvaudiocontrol.setVolume(level);
}

function showWindow() {
    try {
        tizen.tvwindow.show(showWindowCB, null, ['50%', '25%', '50%', '50%'], 'MAIN');
    } catch (error) {
        dump('error: ' + error.name);
    }
}

function showWindowCB(windowRect, type) {
    /* Expected result: ['0', '0', '50%', '50%'] */
    dump('Rectangle: [' + windowRect[0] + ', ' + windowRect[1] + ', ' + windowRect[2] + ', ' + windowRect[3] + ']');
}

//-------------------------
// Initialization
//-------------------------

var init = function () {

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            // Something you want to do when hide or exit.
        } else {
            // Something you want to do when resume.
        }
    });

    // Remote Events
    document.addEventListener('keydown', function (e) {
        switch (e.keyCode) {
            case 37: // LEFT arrow
                break;
            case 38: // UP arrow
                break;
            case 39: // RIGHT arrow
                break;
            case 40: // DOWN arrow
                break;
            case 13: // OK button
                break;
            case 10009: //RETURN button
                tizen.application.getCurrentApplication().exit();
                break;
            default:
                dump('Key code : ' + e.keyCode);
                break;
        }
    });

    tizen.tvaudiocontrol.setVolumeChangeListener(onVolumeChanged);
};

// window.onload can work without <body onload=''>
window.onload = init;
