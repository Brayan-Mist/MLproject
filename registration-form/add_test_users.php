<?php
/**
 * Скрипт для добавления тестовых пользователей в Railway
 */

// Параметры подключения к Railway
$database = getenv("DB_NAME") ?: "railway";
$host = getenv("DB_HOST") ?: "mysql.railway.internal";
$user = getenv("DB_USER") ?: "root";
$password = getenv("DB_PASSWORD") ?: "FFcDuExBPdbUUDhPBTnRSygfJPlGMRvw";
$port = getenv("DB_PORT") ?: "3306";

echo "<h2>Добавление тестовых пользователей</h2>";

try {
    // Подключение к базе данных
    $dsn = "mysql:host=$host;port=$port;dbname=$database;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "<h3 style='color: green;'>✓ Подключение к базе данных успешно!</h3>";
    
    // Тестовые пользователи
    $testUsers = [
        [
            'name' => 'Администратор',
            'email' => 'admin@example.com',
            'password' => md5(sha1('admin123')),
            'gender' => 'male'
        ],
        [
            'name' => 'Тестовый пользователь',
            'email' => 'maklakovmatvija@gmail.com',
            'password' => md5(sha1('123456')),
            'gender' => 'male'
        ],
        [
            'name' => 'Обычный пользователь',
            'email' => 'user@example.com',
            'password' => md5(sha1('user123')),
            'gender' => 'female'
        ]
    ];
    
    echo "<h4>Добавляемые пользователи:</h4>";
    echo "<table border='1' style='border-collapse: collapse; margin: 10px 0;'>";
    echo "<tr style='background: #f0f0f0;'><th>Имя</th><th>Email</th><th>Пароль</th><th>Статус</th></tr>";
    
    $added = 0;
    foreach ($testUsers as $userData) {
        // Проверяем, есть ли уже такой пользователь
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$userData['email']]);
        
        if ($stmt->rowCount() == 0) {
            // Добавляем пользователя
            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, gender) VALUES (?, ?, ?, ?)");
            $stmt->execute([
                $userData['name'],
                $userData['email'],
                $userData['password'],
                $userData['gender']
            ]);
            
            echo "<tr>";
            echo "<td>" . htmlspecialchars($userData['name']) . "</td>";
            echo "<td>" . htmlspecialchars($userData['email']) . "</td>";
            echo "<td>" . ($userData['email'] == 'maklakovmatvija@gmail.com' ? '123456' : ($userData['email'] == 'admin@example.com' ? 'admin123' : 'user123')) . "</td>";
            echo "<td style='color: green;'>✓ Добавлен</td>";
            echo "</tr>";
            $added++;
        } else {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($userData['name']) . "</td>";
            echo "<td>" . htmlspecialchars($userData['email']) . "</td>";
            echo "<td>-</td>";
            echo "<td style='color: orange;'>⚠ Уже существует</td>";
            echo "</tr>";
        }
    }
    
    echo "</table>";
    
    echo "<br><h3>Результат:</h3>";
    echo "✓ Добавлено пользователей: $added<br>";
    
    // Показываем всех пользователей в базе
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
    $totalCount = $stmt->fetch()['count'];
    echo "✓ Всего пользователей в базе: $totalCount<br>";
    
} catch (PDOException $e) {
    echo "<h3 style='color: red;'>✗ Ошибка: " . $e->getMessage() . "</h3>";
}

echo "<br><br>";
echo "<a href='clear_users.php'>Очистить пользователей</a><br>";
echo "<a href='login.html'>На страницу входа</a>";
?>
