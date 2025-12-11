package com.chatplatform;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
public class ChatController {

    @PostMapping("/api/login")
    public Map<String, String> login(@RequestBody Map<String, String> user) {
        return Map.of("status", "success", "username", user.get("username"));
    }

    @Controller
    public static class WebSocketController {
        @MessageMapping("/chat")
        @SendTo("/topic/messages")
        public Message sendMessage(Message message) {
            message.setTimestamp(System.currentTimeMillis());
            return message;
        }
    }
}