package com.company.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Data
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String tokenType = "Bearer";
    private String email;
    private String role;
    /** The account's name, so the UI can greet a person rather than an email address. */
    private String username;

    public AuthResponse(String token, String email, String role) {
        this.token = token;
        this.email = email;
        this.role = role;
    }

    public AuthResponse(String token, String email, String role, String username) {
        this(token, email, role);
        this.username = username;
    }
}
