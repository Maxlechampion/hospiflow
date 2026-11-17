<?php

use App\Http\Controllers\PatientController;

test('portableLike produces LOWER LIKE LOWER pattern', function () {
    $controller = new PatientController;
    $reflection = new ReflectionClass($controller);
    $method = $reflection->getMethod('portableLike');
    $method->setAccessible(true);

    $result = $method->invoke($controller, 'first_name');
    expect($result)->toBe('LOWER(first_name) LIKE LOWER(?)');
});

test('likePattern escapes special characters', function () {
    $controller = new PatientController;
    $reflection = new ReflectionClass($controller);
    $method = $reflection->getMethod('likePattern');
    $method->setAccessible(true);

    expect($method->invoke($controller, 'aminata'))->toBe('%aminata%');
    expect($method->invoke($controller, 'a%b'))->toBe('%a\\%b%');
    expect($method->invoke($controller, 'a_b'))->toBe('%a\\_b%');
});
