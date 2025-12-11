package com.chatplatform.repository;

import com.chatplatform.model.Message;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {
    List<Message> findTop50ByOrderByTimestampDesc();
}