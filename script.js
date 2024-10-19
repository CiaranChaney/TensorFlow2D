/**
 * Get the car data reduced to just the variables we are interested
 * and cleaned of missing data.
 */
async function getData() {
    const carsDataResponse = await fetch('https://storage.googleapis.com/tfjs-tutorials/carsData.json');
    const carsData = await carsDataResponse.json();
    const cleaned = carsData.map(car => ({
      mpg: car.Miles_per_Gallon,
      horsepower: car.Horsepower,
    }))
    .filter(car => (car.mpg != null && car.horsepower != null));
  
    return cleaned;
  }

function createModel() {
    //Create a Sequential model
    const model = tf.sequential();

    //Add a single input layer
    model.add(tf.layers.dense({inputShape: [1], units: 1, useBias: true}));

    //Add an output layer
    model.add(tf.layers.dense({units: 1, useBias: true}));

    return model;
}

function convertToTensor(data) {

    //Wrap the calculations in a tidy to remote intermediate tensors
    return tf.tidy(() => {

        // 1. Shuffle the data
        tf.util.shuffle(data);

        // 2. Convert data to a tensor
        const inputs = data.map(d => d.horsepower)
        const labels = data.map(d => d.mpg);

        const inputTensor = tf.tensor2d(inputs, [inputs.length, 1]);
        const labelTensor = tf.tensor2d(labels, [labels.length, 1]);

        // 3. Normalise the data in range 0 - 1
        const inputMax = inputTensor.max();
        const inputMin = inputTensor.min();
        const labelMax = labelTensor.max();
        const labelMin = labelTensor.min();

        const normalisedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
        const normalisedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));

        return {
            inputs: normalisedInputs,
            labels: normalisedLabels,

            //Return Min Max bounds for later
            inputMax,
            inputMin,
            labelMax,
            labelMin,

        }
    })

}

async function trainModel(model, inputs, labels) {

    // Prepare model for training
    model.compile({
        optimizer: tf.train.adam(),
        loss: tf.losses.meanSquaredError,
        metrics: ['mse'],


    });

    const batchSize = 32;
    const epochs = 70;

    return await model.fit(inputs, labels, {
        batchSize,
        epochs,
        shuffle: true,
        callbacks: tfvis.show.fitCallbacks(
            {name: 'Training Performance'},
            ['loss', 'mse'],
            {height: 200, callbacks: ['onEpochEnd'] }
        )
    })
    
  }

function testModel(model, inputData, normalisationData) {

    const {inputMax, inputMin, labelMin, labelMax} = normalisationData;

    // Make predictions for a range of numbers between 0 and 1
    // Un normalise data by doing reverse min-max scaling

    const [xs, preds] = tf.tidy(() =>{

        const xsNorm = tf.linspace(0, 1, 100);
        const predictions = model.predict(xsNorm.reshape([100, 1]));

        const unNormXs = xsNorm
            .mul(inputMax.sub(inputMin))
            .add(inputMin);

        const unNormPreds = predictions
            .mul(labelMax.sub(labelMin))
            .add(labelMin);

        return [unNormXs.dataSync(), unNormPreds.dataSync()];
    });

    const predictedPoints = Array.from(xs).map((val, i) => {
        return {x: val, y: preds[i]}
    });

    const originalPoints = inputData.map(d => ({
        x: d.horsepower, y: d.mpg
    }));

    tfvis.render.scatterplot(
        {name: 'Model Predictions vs Original Data'},
        {values: [originalPoints, predictedPoints], series: ['original', 'predicted']},
        {
            xLabel: 'Horsepower',
            yLabel: 'MPG',
            height: 300
        }
    );
}

  
async function run() {
    // Load and plot the original input data that we are going to train on.
    const data = await getData();
    const values = data.map(d => ({
      x: d.horsepower,
      y: d.mpg,
    }));
  
    tfvis.render.scatterplot(
      {name: 'Horsepower v MPG'},
      {values},
      {
        xLabel: 'Horsepower',
        yLabel: 'MPG',
        height: 300
      }
    );
  
    const model = createModel();
    tfvis.show.modelSummary({name: 'Model Summary'}, model);

    // Convert data to form used for training
    const tensorData = convertToTensor(data);
    const {inputs, labels} = tensorData;

    // Train the model
    await trainModel(model, inputs, labels);
    console.log('Done Training');

    testModel(model, data, tensorData);
}

  
document.addEventListener('DOMContentLoaded', run);