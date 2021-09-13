# ALO API Reference


## `GET /`

**Description:** Fetches the status of the backend.


## `POST /auth`

**Description:** Generate a token to sign in with.

**Parameters:**

Name | Type | Description | Example
--- | --- | --- | ---
**username** | `String` | Username | s1141551@student.windesheim.nl
**password** | `String` | Password | th!$I$AG00dPa$$w0rd


## `GET /info`

**Description:** Fetches the user's information.


## `GET /courses`

**Description:** Fetches an array courses.


## `GET /grades`

**Description:** Fetches an array grades.


## `GET /groups`

**Description:** Fetches an array groups.


## `GET /teachers`

**Description:** Fetches an array teachers.


## `GET /search/group`

**Description:** Fetches an array groups.

**Parameters:**

Name | Type | Description | Example
--- | --- | --- | ---
**query** | `String` | Search term | ICTM2L


## `GET /search/course`

**Description:** Fetches an array courses.

**Parameters:**

Name | Type | Description | Example
--- | --- | --- | ---
**query** | `String` | Search term | Java


## `GET /search/teachers`

**Description:** Fetches an array teachers.

**Parameters:**

Name | Type | Description | Example
--- | --- | --- | ---
**query** | `String` | Search term | Henk