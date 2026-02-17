<?php
/**
 * Скрипт для очистки пользователей в базе данных Railway
 */

// Параметры подключения к Railway
$database = getenv("DB_NAME") ?: "railway";
$host = getenv("DB_HOST") ?: "mysql.railway.internal";
$user = getenv("DB_USER") ?: "root";
$password = getenv("DB_PASSWORD") ?: "FFcDuExBPdbUUDhPBTnRSygfJPlGMRvw";
$port = getenv("DB_PORT") ?: "3306";

echo "<h2>Очистка базы данных пользователей</h2>";

try {
    // Подключение к базе данных
    $dsn = "mysql:host=$host;port=$port;dbname=$database;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    echo "<h3 style='color: green;'>✓ Подключение к базе данных успешно!</h3>";
    echo "<br><strong>Параметры подключения:</strong><br>";
    echo "База: $database<br>";
    echo "Хост: $host<br>";
    echo "Пользователь: $user<br>";
    echo "Порт: $port<br><br>";
    
    // Показываем текущее количество пользователей
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
    $count = $stmt->fetch()['count'];
    echo "<strong>Текущее количество пользователей:</strong> $count<br><br>";
    
    if ($count > 0) {
        // Показываем пользователей перед удалением
        echo "<h4>Пользователи перед удалением:</h4>";
        $stmt = $pdo->query("SELECT id, name, email FROM users");
        echo "<table border='1' style='border-collapse: collapse; margin: 10px 0;'>";
        echo "<tr style='background: #f0f0f0;'><th>ID</th><th>Имя</th><th>Email</th></tr>";
        
        while ($user = $stmt->fetch()) {
            echo "<tr>";
            echo "<td>" . $user['id'] . "</td>";
            echo "<td>" . htmlspecialchars($user['name']) . "</td>";
            echo "<td>" . htmlspecialchars($user['email']) . "</td>";
            echo "</tr>";
        }
        echo "</table><br>";
        
        if (isset($_GET['confirm']) && $_GET['confirm'] == 'yes') {
            // Удаляем всех пользователей
            $stmt = $pdo->exec("DELETE FROM users");
            echo "<h3 style='color: red;'><strong>✓ Все пользователи удалены!</strong></h3>";
            echo "Удалено записей: $stmt<br>";
            
            // Сбрасываем автоинкремент
            $pdo->exec("ALTER TABLE users AUTO_INCREMENT = 1");
            echo "✓ Счетчик ID сброшен<br>";
            
            echo "<br><a href=''>Вернуться</a>";
        } else {
            echo "<div style='background: #fff3cd; padding: 15px; border: 1px solid #ffeaa7; border-radius: 5px; margin: 10px 0;'>";
            echo "<strong>⚠️ ВНИМАНИЕ!</strong><br>";
            echo "Это действие удалит ВСЕХ пользователей из базы данных!<br>";
            echo "Отменить это действие будет невозможно.<br><br>";
            echo "<a href='?confirm=yes' style='background: #e74c3c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Удалить всех пользователей</a>";
            echo "</div>";
        }
    } else {
        echo "<h3 style='color: orange;'>⚠️ В базе данных нет пользователей для удаления</h3>";
    }
    
} catch (PDOException $e) {
    echo "<h3 style='color: red;'>✗ Ошибка подключения: " . $e->getMessage() . "</h3>";
    echo "<br><strong>Возможные решения:</strong><br>";
    echo "1. Проверьте переменные окружения в Railway<br>";
    echo "2. Убедитесь что база данных существует<br>";
    echo "3. Проверьте права доступа пользователя<br>";
}

echo "<br><br>";
echo "<a href='javascript:history.back()'>Назад</a>";
?>
