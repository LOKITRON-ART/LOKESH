$(document).ready(function() {
    // Fetch and display all users
    $.ajax({
        url: '/api/users',
        method: 'GET',
        success: function(users) {
            users.forEach(user => {
                $('#userTable tbody').append(`
                    <tr data-id="${user._id}">
                        <td>${user.Username}</td>
                        <td>${user.Mail}</td>
                        <td>
                            <button class="showButton">Show</button>
                            <button class="editButton">Edit</button>
                            <button class="deleteButton">Delete</button>
                        </td>
                    </tr>
                `);
            });
        }
    });

    // Show user details
    $(document).on('click', '.showButton', function() {
        const userId = $(this).closest('tr').data('id');
        $.ajax({
            url: `/api/user/details?email=${userId}`,
            method: 'GET',
            success: function(user) {
                $('#userDetails').show();
                $('#userId').val(user._id);
                $('#username').val(user.Username);
                $('#email').val(user.Mail);
                $('#city').val(user.City);
                $('#postalCode').val(user.Postal_Code);
                $('#telephoneCode').val(user.Telephone_Code);
                $('#mobileNumber').val(user.Mobile_Number);
                $('#alternateEmail').val(user.Alternate_Email_Address);
            }
        });
    });

    // Edit user details
    $(document).on('click', '.editButton', function() {
        const userId = $(this).closest('tr').data('id');
        $.ajax({
            url: `/api/user/details?email=${userId}`,
            method: 'GET',
            success: function(user) {
                $('#userDetails').show();
                $('#userId').val(user._id);
                $('#username').val(user.Username);
                $('#email').val(user.Mail);
                $('#city').val(user.City);
                $('#postalCode').val(user.Postal_Code);
                $('#telephoneCode').val(user.Telephone_Code);
                $('#mobileNumber').val(user.Mobile_Number);
                $('#alternateEmail').val(user.Alternate_Email_Address);
                $('#userForm input').prop('disabled', false); // Enable form fields for editing
                $('#saveButton').show();
            }
        });
    });

    // Save user details
    $('#saveButton').on('click', function() {
        const userId = $('#userId').val();
        const city = $('#city').val();
        const postalCode = $('#postalCode').val();
        const telephoneCode = $('#telephoneCode').val();
        const mobileNumber = $('#mobileNumber').val();
        const alternateEmail = $('#alternateEmail').val();

        $.ajax({
            url: '/api/user/update',
            method: 'POST',
            data: {
                userId,
                city,
                postalCode,
                telephoneCode,
                mobileNumber,
                alternateEmail
            },
            success: function() {
                alert('User details updated successfully');
                $('#userDetails').hide();
                location.reload(); // Refresh the page to reflect changes
            }
        });
    });

    // Delete user
    $(document).on('click', '.deleteButton', function() {
        const userId = $(this).closest('tr').data('id');
        $.ajax({
            url: `/api/user/delete/${userId}`,
            method: 'DELETE',
            success: function() {
                alert('User deleted successfully');
                location.reload(); // Refresh the page to reflect changes
            }
        });
    });
});
