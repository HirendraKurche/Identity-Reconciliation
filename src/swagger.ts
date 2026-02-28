import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Bitespeed Identity Reconciliation API",
            version: "1.0.0",
            description:
                "Identity Reconciliation Web Service — Links customer contacts across orders by matching email and phone number.",
        },
        servers: [
            {
                url: "/",
                description: "Current server",
            },
        ],
        paths: {
            "/identify": {
                post: {
                    summary: "Identify and reconcile a contact",
                    description:
                        "Receives an email and/or phone number and links them to an existing contact cluster, or creates a new one. Returns the consolidated contact information.",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        email: {
                                            type: "string",
                                            example: "mcfly@hillvalley.edu",
                                            description: "Customer email address",
                                        },
                                        phoneNumber: {
                                            type: "string",
                                            example: "123456",
                                            description: "Customer phone number",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Successfully identified and reconciled the contact",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            contact: {
                                                type: "object",
                                                properties: {
                                                    primaryContatctId: {
                                                        type: "integer",
                                                        description: "ID of the primary contact",
                                                        example: 1,
                                                    },
                                                    emails: {
                                                        type: "array",
                                                        items: { type: "string" },
                                                        description:
                                                            "All emails in the contact cluster (primary first)",
                                                        example: [
                                                            "lorraine@hillvalley.edu",
                                                            "mcfly@hillvalley.edu",
                                                        ],
                                                    },
                                                    phoneNumbers: {
                                                        type: "array",
                                                        items: { type: "string" },
                                                        description:
                                                            "All phone numbers in the contact cluster (primary first)",
                                                        example: ["123456"],
                                                    },
                                                    secondaryContactIds: {
                                                        type: "array",
                                                        items: { type: "integer" },
                                                        description:
                                                            "IDs of all secondary contacts linked to the primary",
                                                        example: [23],
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        "400": {
                            description: "Bad request — at least one of email or phoneNumber is required",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            error: {
                                                type: "string",
                                                example:
                                                    "At least one of email or phoneNumber is required.",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        "500": {
                            description: "Internal server error",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            error: {
                                                type: "string",
                                                example: "Internal server error",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
