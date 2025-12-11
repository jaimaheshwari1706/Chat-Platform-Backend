package com.chatplatform.controller;

import com.chatplatform.model.Message;
import com.chatplatform.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@Controller
public class ChatController {
    
    @Autowired
    private MessageRepository messageRepository;
    
    @MessageMapping("/chat")
    @SendTo("/topic/messages")
    public Message sendMessage(Message message) {
        message.setTimestamp(LocalDateTime.now());
        messageRepository.save(message);
        return message;
    }
}

@RestController
class MessageController {
    
    @Autowired
    private MessageRepository messageRepository;
    
    @GetMapping("/api/messages")
    public List<Message> getRecentMessages() {
        return messageRepository.findTop50ByOrderByTimestampDesc();
    }
}