/* =================================================== */
/* ===== Section 1: Require all the dependencies ===== */
/* =================================================== */

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({
    dest: './files/'
});
const hbs = require('hbs');
const logger = require('morgan');
var Timeout = require('smart-timeout')

var crypto = require("crypto");
var fs = require("fs");
var http = require("http")
var path = require("path")
var ursa = require("ursa");
var ledgerAPI = require('./ledgerAPI')
var move = require('./fileMovement')

// const fileUpload = require('express-fileupload');
const cookieParser = require("cookie-parser");

// Define port for app to listen on
const port = process.env.PORT || 3000;

/* ==================================================== */
/* ===== Section 2: Configure express middlewares ===== */
/* ==================================================== */

const app = express();
app.use(bodyParser()); // to use bodyParser (for text/number data transfer between clientg and server)
app.set('view engine', 'hbs'); // setting hbs as the view engine

app.set('view engine', 'html');
app.engine('html', require('hbs').__express);

var router = express.Router();
app.use(express.static(__dirname + '/web')); // making ./public as the static directory
app.use(express.static(__dirname + '/files')); // making ./public as the static directory
app.use('/', router);
module.exports = router;
app.set('views', __dirname + '/web'); // making ./views as the views directory
app.use(logger('dev')); // Creating a logger (using morgan)
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));

app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
// app.use(fileUpload());
// app.use(express.static(__dirname + '/web'));

router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now())
    next()
})


const server = http.createServer(app);

///////////////////////////
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');

//
var fabric_client = new Fabric_Client();

// setup the fabric network
var channel = fabric_client.newChannel('mychannel');
var peer = fabric_client.newPeer('grpc://localhost:7051');
channel.addPeer(peer);
var order = fabric_client.newOrderer('grpc://localhost:7050')
channel.addOrderer(order);

//
var member_user = null;
var store_path = path.join(__dirname, 'hfc-key-store');
console.log('Store path:' + store_path);
var tx_id = null;


// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
Fabric_Client.newDefaultKeyValueStore({
    path: store_path
}).then((state_store) => {
    // assign the store to the fabric client
    fabric_client.setStateStore(state_store);
    var crypto_suite = Fabric_Client.newCryptoSuite();
    // use the same location for the state store (where the users' certificate are kept)
    // and the crypto store (where the users' keys are kept)
    var crypto_store = Fabric_Client.newCryptoKeyStore({
        path: store_path
    });
    crypto_suite.setCryptoKeyStore(crypto_store);
    fabric_client.setCryptoSuite(crypto_suite);

    // get the enrolled user from persistence, this user will sign all requests
    return fabric_client.getUserContext('user1', true);
}).then((user_from_store) => {
    if (user_from_store && user_from_store.isEnrolled()) {
        console.log('Successfully loaded user1 from persistence');
        member_user = user_from_store;
    } else {
        throw new Error('Failed to get user1.... run registerUser.js');
    }
});
////////////////////////////

app.get('/afterVote', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else res.sendFile(path.join(__dirname + '/web/afterVote.html'));// res.sendFile(path.join(__dirname + '/web/result.html'));

});

app.get('/', (req, res) => {
    res.redirect('/register');
});

app.get('/register', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else res.redirect('/login');

})

app.get('/addArea', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else res.sendFile(path.join(__dirname + '/web/addArea.html'));

})
app.get('/vote/:candidateKey', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else {
        // get a transaction id object based on the current user assigned to fabric client
        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction_id: ", tx_id._transaction_id);

        var request = {
            chaincodeId: 'fabcar',
            fcn: 'addVote',
            args: [req.params.candidateKey],
            chainId: 'mychannel',
            txId: tx_id
        };

        ledgerAPI.slimInvoke(channel, request, peer).then(() => {
            res.redirect('/hasAlreadyVoted');
        }).catch((err) => {
            console.error('Failed to invoke successfully :: ' + err);
        });

    }
})


app.get('/hasAlreadyVoted',(req,res)=>{
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else {
        console.log(req.cookies.Key)
        const request = {
            chaincodeId: 'fabcar',
            fcn: 'hasAlreadyVoted',
            args: [req.cookies.Key]
        }

        console.log(request);
        ledgerAPI.slimQuery(channel, request).then((result) => {
            console.log(result);
        }).catch((err) => {
            console.error('Failed to query successfully :: ' + err);
        });
    }
})
app.get('/addelection', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else res.sendFile(path.join(__dirname + '/web/election.html'));

})
app.get('/addCandidate', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else res.sendFile(path.join(__dirname + '/web/candidate.html'));

})
app.get('/showCandidateList', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else {
        const request = {
            chaincodeId: 'fabcar',
            fcn: 'getCandidateList',
            args: [req.cookies.Key]
        }

        console.log(request);
        ledgerAPI.slimQuery(channel, request).then((result) => {
            console.log(result);
            res.render('candidateList.html', {
                candidates: result.values
            });
        }).catch((err) => {
            console.error('Failed to query successfully :: ' + err);
        });


        //res.sendFile(path.join(__dirname + '/web/user.html'));
    }


})
app.get('/login', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/login.html'));
    else res.redirect('/user'); // res.sendFile(path.join(__dirname + '/web/user.html'));

})
app.get('/user', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/login.html'));
    else {



        const request = {
            chaincodeId: 'fabcar',
            fcn: 'getCandidates',
            args: [req.cookies.Key]
        }

        console.log(request);
        ledgerAPI.slimQuery(channel, request).then((result) => {
            console.log(result);
           
        }).catch((err) => {
            console.error('Failed to query successfully :: ' + err);
        });


        //res.sendFile(path.join(__dirname + '/web/user.html'));
    }

})

app.get('/admin', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/admin.html'));
    else res.sendFile(path.join(__dirname + '/web/vote.html'));
})
app.get('/result', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
})
app.get('/history', (req, res) => {
    if (req.cookies.Key == null) res.sendFile(path.join(__dirname + '/web/signup.html'));
    else res.sendFile(path.join(__dirname + '/web/history.html'));
})


app.get('/logout', (req, res) => {
    //res.sendFile(path.join(__dirname + '/web/logoutnew.html'));
    //res.send(users);
    //edited
    //var Key = req.cookies.Key;
    res.clearCookie('Key');
    res.clearCookie('Email');
    res.redirect('/');

})
app.get('/adminLogout', (req, res) => {
    //res.sendFile(path.join(__dirname + '/web/logoutnew.html'));
    //res.send(users);
    //edited
    //var Key = req.cookies.Key;
    res.clearCookie('Key');
    res.clearCookie('Email');
    res.redirect('/admin');

})

app.get('/uploadDocument', (req, res) => {
    if (req.cookies.token == null) res.redirect('/login');
    else res.render('uploadDocument.html', {
        userToken: req.cookies.token
    });
    //  res.sendFile(path.join(__dirname + '/web/uploadDocument.html'));
})

app.get('/listRequest', (req, res) => {
    if (req.cookies.token == null) res.redirect('/login');
    else res.sendFile(path.join(__dirname + '/web/listRequest.html'));
})

app.get('/listOfRequest', (req, res) => {
    if (req.cookies.token == null) res.redirect('/login');
    else res.sendFile(path.join(__dirname + '/web/listOfRequest.html'));
})

///admin
app.post('/admin', (req, res) => {
    const commission = {
        Email: req.body.Email,
        Password: req.body.Password
    };
    const request = {
        chaincodeId: 'fabcar',
        fcn: 'admin',
        args: [commission.Email, commission.Password]
    };

    console.log(request);

    // send the query proposal to the peer
    ledgerAPI.slimQuery(channel, request).then((result) => {
        console.log(result);

        res.cookie('Key', result.Key);
        res.cookie('Email', result.Email)
        res.redirect('/admin');
    })
        .catch((err) => {
            console.error('Failed to query successfully :: ' + err);
        });

});
///admin

app.post('/addArea', (req, res) => {
    const addArea = {
        areaName: req.body.areaName,
        divisionName: req.body.divisionName,
        districtName: req.body.districtName,
        thanaName: req.body.thanaName
    };

    // get a transaction id object based on the current user assigned to fabric client
    tx_id = fabric_client.newTransactionID();
    console.log("Assigning transaction_id: ", tx_id._transaction_id);

    var request = {
        chaincodeId: 'fabcar',
        fcn: 'addArea',
        args: [addArea.areaName, addArea.divisionName, addArea.districtName, addArea.thanaName],
        chainId: 'mychannel',
        txId: tx_id
    };

    console.log("request has been set");

    // send the transaction proposal to the peers
    ledgerAPI.slimInvoke(channel, request, peer).then(() => {
        res.redirect('/addArea');
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
    });
});


app.post('/register', (req, res) => {
    const user = {
        Nid: req.body.Nid,
        Birthdate: req.body.Birthdate,
        Mobile: req.body.Mobile,
        Email: req.body.Email,
        PresentDivision: req.body.PresentDivision,
        PresentDistrict: req.body.PresentDistrict,
        PresentThana: req.body.PermanentThana,
        PermanentDivision: req.body.PermanentDivision,
        PermanentDistrict: req.body.PermanentDistrict,
        PermanentThana: req.body.PermanentThana,
        Password: req.body.Password
    };

    // get a transaction id object based on the current user assigned to fabric client
    tx_id = fabric_client.newTransactionID();
    console.log("Assigning transaction_id: ", tx_id._transaction_id);

    console.log(user.Password);
    user.Password = crypto.createHash('sha256').update(user.Password).digest("base64");
    console.log(user.Password)

    var request = {
        chaincodeId: 'fabcar',
        fcn: 'register',
        args: [user.Nid, user.Mobile, user.Birthdate, user.Email, user.PresentDivision, user.PermanentDistrict, user.PresentThana, user.PermanentDivision, user.PermanentDistrict, user.PermanentThana, user.Password],

        chainId: 'mychannel',
        txId: tx_id
    };

    console.log("request has been set");

    // send the transaction proposal to the peers
    ledgerAPI.slimInvoke(channel, request, peer).then(() => {
        res.redirect('/login');
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
    });
});



app.post('/addElection', (req, res) => {
    const election = {
        AddElection: req.body.addElection
    };

    // get a transaction id object based on the current user assigned to fabric client
    tx_id = fabric_client.newTransactionID();
    console.log("Assigning transaction_id: ", tx_id._transaction_id);

    var request = {
        chaincodeId: 'fabcar',
        fcn: 'addElection',
        args: [election.AddElection],
        chainId: 'mychannel',
        txId: tx_id
    };

    ledgerAPI.slimInvoke(channel, request, peer).then(() => {
        res.redirect('/addElection');
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
    });
});

app.post('/addCandidate', (req, res) => {
    const candidate = {
        electionName: req.body.electionName,
        candidateName: req.body.candidateName,
        areaName: req.body.areaName,
        sign: req.body.sign
    };

    // get a transaction id object based on the current user assigned to fabric client
    tx_id = fabric_client.newTransactionID();
    console.log("Assigning transaction_id: ", tx_id._transaction_id);

    var request = {
        chaincodeId: 'fabcar',
        fcn: 'addCandidate',
        args: [candidate.electionName, candidate.candidateName, candidate.areaName, candidate.sign],
        chainId: 'mychannel',
        txId: tx_id
    };

    // send the transaction proposal to the peers
    ledgerAPI.slimInvoke(channel, request, peer).then(() => {
        res.redirect('/addCandidate');
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
    });
});

app.post('/login', (req, res) => {
    const user = {
        Nid: req.body.Nid,
        Birthdate: req.body.Birthdate,
        Password: req.body.Password
    };

    console.log(user.Password)
    user.Password = crypto.createHash('sha256').update(user.Password).digest("base64");
    console.log(user.Password)

    const request = {
        chaincodeId: 'fabcar',
        fcn: 'login',
        args: [user.Nid, user.Birthdate, user.Password]
    }
    // send the query proposal to the peer
    ledgerAPI.slimQuery(channel, request).then((result) => {
        console.log(result);
        res.cookie('Key', result.Key);
        res.cookie('Email', result.Email);
        res.redirect('/user');
    }).catch((err) => {
        console.error('Failed to query successfully :: ' + err);
    });
});

server.listen(port, err => {
    if (err) {
        throw err
    }
    console.log('server started at 127.0.0.1:3000');
})