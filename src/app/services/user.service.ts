import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * UserService
 * Central place for HTTP calls related to user management.
 *
 * Notes:
 * - The `apiUrl` is currently pointed at a local Spring Boot backend.
 * - Responses are returned as Observables so components can subscribe and
 *   handle success / error cases appropriately.
 * - You can extend this service with additional endpoints (for example a
 *   `postBudgets(payload)` method) to keep API calls grouped by domain.
 */
@Injectable({
  providedIn: 'root'
})

export class UserService {

  // Base URL for user-related API endpoints. Update to match your backend.
  private apiUrl = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) { }

  /**
   * Register a new user.
   * Expects `user` to be an object containing fields like { name, email, password }
   * Returns the backend response (commonly the created user or a success message).
   */
  registerUser(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  /**
   * Login a user with credentials { email, password }.
   * Backend should return an auth token or user object depending on implementation.
   */
  loginUser(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  /**
   * Fetch all users.
   * Returns an array of user objects. Components should handle errors and
   * display friendly messages when the observable errors.
   */
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}`);
  }

  /**
   * Example extension:
   * If you want to post budgets to the backend, add a method like:
   *
   * postBudgets(payload: any): Observable<any> {
   *   return this.http.post(`${this.apiUrl}/budgets`, payload);
   * }
   *
   * Keep API endpoints grouped by domain (user vs budgets) to make the
   * client code easier to maintain.
   */

}
