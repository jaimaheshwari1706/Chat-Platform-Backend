package com.chatplatform.controller;

import com.chatplatform.model.User;
import com.chatplatform.security.JwtUtil;
import com.chatplatform.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String password = request.get("password");
            
            User user = userService.registerUser(username, password);
            String token = jwtUtil.generateToken(username);
            
            return ResponseEntity.ok(Map.of(
                "token", token,
                "username", username
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");
        
        Optional<User> user = userService.authenticateUser(username, password);
        
        if (user.isPresent()) {
            String token = jwtUtil.generateToken(username);
            return ResponseEntity.ok(Map.of(
                "token", token,
                "username", username
            ));
        }
        
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid credentials"));
    }
}