var express = require("express");
var router = express.Router();
let mongoose = require('mongoose');
let messageModel = require('../schemas/messages');
let { CheckLogin } = require('../utils/authHandler');
let { uploadFile } = require('../utils/uploadHandler');

// 1. GET "/" lấy message cuối cùng của mỗi user mà user hiện tại nhắn tin hoặc user khác nhắn cho user hiện tại
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUser = req.user._id;

        // Use aggregation to group by the "other" user and get the latest message
        let conversations = await messageModel.aggregate([
            {
                $match: {
                    $or: [
                        { from: currentUser },
                        { to: currentUser }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 } // Sort by descending date
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$from", currentUser] },
                            "$to",
                            "$from"
                        ]
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                $replaceRoot: { newRoot: "$lastMessage" }
            },
            {
                $sort: { createdAt: -1 } // Sort all last messages by newest
            }
        ]);

        res.status(200).send(conversations);

    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// 2. GET "/:userID" lấy toàn bộ message from: user hiện tại, to :userID và from: userID và to:user hiện tại
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUser = req.user._id;
        let otherUser = req.params.userID;
        
        // Convert to ObjectId for querying
        let currentUserId = new mongoose.Types.ObjectId(currentUser);
        let otherUserId = new mongoose.Types.ObjectId(otherUser);

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId, to: otherUserId },
                { from: otherUserId, to: currentUserId }
            ]
        }).sort({ createdAt: 1 }); // Sort by chronological order

        res.status(200).send(messages);

    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// 3. POST "/" post nội dung bao gồm file hoặc text, to userID
router.post('/', CheckLogin, uploadFile.single('file'), async function (req, res, next) {
    try {
        let from = req.user._id;
        let to = req.body.to; // ID of the recipient
        let type = 'text';
        let text = req.body.text; 

        // Nếu có chứa file thì type là file, text là path dẫn đến file
        if (req.file) {
            type = 'file';
            text = req.file.path; // Save the raw path as required by teacher
        }

        // Tạo message
        let newMessage = new messageModel({
            from: from,
            to: to,
            messageContent: {
                type: type,
                text: text
            }
        });

        await newMessage.save();
        res.status(201).send(newMessage);

    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
