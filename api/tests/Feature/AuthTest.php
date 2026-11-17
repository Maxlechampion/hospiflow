<?php

use App\Models\Facility;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->facility = Facility::factory()->create();
    $this->user = User::factory()->create([
        'email' => 'test@hospiflow.dev',
        'password' => Hash::make('password123'),
        'is_active' => true,
        'current_facility_id' => $this->facility->id,
    ]);
    $this->user->facilities()->attach($this->facility->id);
});

test('login returns a token with valid credentials', function () {
    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@hospiflow.dev',
        'password' => 'password123',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'token',
            'user' => ['id', 'name', 'email'],
        ]);

    expect($response->json('token'))->toBeString()->not->toBeEmpty();
});

test('login fails with invalid credentials', function () {
    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@hospiflow.dev',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'validation.failed');
});

test('login fails with inactive account', function () {
    $this->user->update(['is_active' => false]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@hospiflow.dev',
        'password' => 'password123',
    ]);

    $response->assertStatus(403);
});

test('login is rate limited after 5 attempts', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/auth/login', [
            'email' => 'test@hospiflow.dev',
            'password' => 'wrong-password',
        ]);
    }

    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@hospiflow.dev',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(429);
});

test('me returns the authenticated user', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/auth/me');

    $response->assertStatus(200)
        ->assertJsonPath('user.id', $this->user->id)
        ->assertJsonPath('user.email', 'test@hospiflow.dev');
});

test('me requires authentication', function () {
    $this->getJson('/api/auth/me')->assertStatus(401);
});

test('logout invalidates the current token', function () {
    $token = $this->user->createToken('spa')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/auth/logout');

    $response->assertStatus(200);
    expect($this->user->tokens()->count())->toBe(0);
});
