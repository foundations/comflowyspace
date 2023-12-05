import React, { useState } from 'react';
import { Button, Card, Space } from 'antd';

// Your model data
const allModels = {
    type1: [
        { name: 'Model A', size: 1 },
        { name: 'Model B', size: 2 },
    ],
    type2: [
        { name: 'Model C', size: 1.5 },
        { name: 'Model D', size: 3 },
    ],
    // Add more types and models as needed
};

const InstalledModels = () => {
    const [selectedType, setSelectedType] = useState('type1'); // State to keep track of the selected model type

    // Function to handle type filter change
    const handleTypeFilterChange = (type) => {
        setSelectedType(type);
    };

    // Function to get all unique model types
    const getModelTypes = () => {
        const types = Object.keys(allModels);
        return types;
    };

    // Function to get the number of models for a given type
    const getModelCount = (type) => {
        return allModels[type].length;
    };

    // Function to get models for the selected type
    const getModelsForType = () => {
        return selectedType ? allModels[selectedType] : [];
    };

    return (
        <div className="installed-models">
            <div>
                <span>Filter by Type:</span>
                {getModelTypes().map((type) => (
                    <Button key={type} onClick={() => handleTypeFilterChange(type)}>
                        {`${type} (${getModelCount(type)})`}
                    </Button>
                ))}
            </div>
            <div>
                <ModelList models={getModelsForType()} />
            </div>
        </div>
    );
};

const ModelList = ({ models }) => {
    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            {models.map((model, index) => (
                <Card key={index} title={model.name} style={{ width: 300, margin: '16px' }}>
                    <p>Size: {model.size}GB</p>
                </Card>
            ))}
        </Space>
    );
};

export default InstalledModels;